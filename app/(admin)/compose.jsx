import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import Colors from '../../constants/colors';

import {
  getGroups,
  getMembers,
  sendMessage
} from '../../lib/api';

export default function Compose() {

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);

  const [selectedMembers, setSelectedMembers] = useState([]);

  const [selectedGroup, setSelectedGroup] = useState(null);

  const [sendToAll, setSendToAll] = useState(false);

  const [loading, setLoading] = useState(false);

  const [fetching, setFetching] = useState(true);

  const [file, setFile] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {

    try {

      const [mRes, gRes] =
        await Promise.all([
          getMembers(),
          getGroups()
        ]);

      setMembers(mRes.data || []);

      setGroups(gRes.data || []);

    } catch (err) {

      Alert.alert(
        'Error',
        'Failed to load data'
      );

    } finally {

      setFetching(false);
    }
  };

  const pickImage = async () => {

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          ImagePicker.MediaTypeOptions.Images,

        quality: 0.8
      });

    if (!result.canceled) {

      setFile(result.assets[0]);
    }
  };

  const pickDocument = async () => {

    const result =
      await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true
      });

    if (!result.canceled) {

      setFile(result.assets[0]);
    }
  };

  const toggleMember = (id) => {

    setSelectedMembers(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );

    setSelectedGroup(null);

    setSendToAll(false);
  };

  const handleSend = async () => {

    if (!title.trim()) {

      Alert.alert(
        'Error',
        'Title required'
      );

      return;
    }

    try {

      setLoading(true);

      const formData =
        new FormData();

      formData.append(
        'title',
        title
      );

      formData.append(
        'body',
        body
      );

      if (sendToAll) {

        formData.append(
          'targetType',
          'all'
        );

      } else if (selectedGroup) {

        formData.append(
          'targetType',
          'group'
        );

        formData.append(
          'targetId',
          selectedGroup
        );

      } else if (
        selectedMembers.length > 0
      ) {

        formData.append(
          'targetType',
          'members'
        );

        formData.append(
          'memberIds',
          JSON.stringify(
            selectedMembers
          )
        );
      }

      // FILE

      if (file) {

        formData.append(
          'file',
          {
            uri: file.uri,
            name:
              file.name ||
              'upload.jpg',

            type:
              file.mimeType ||
              'application/octet-stream'
          }
        );
      }

      await sendMessage(formData);

      Alert.alert(
        'Success',
        'Message sent'
      );

      setTitle('');
      setBody('');
      setSelectedMembers([]);
      setSelectedGroup(null);
      setSendToAll(false);
      setFile(null);

    } catch (err) {

      console.log(
        err?.response?.data || err
      );

      Alert.alert(
        'Error',
        err?.response?.data?.error ||
        'Failed to send'
      );

    } finally {

      setLoading(false);
    }
  };

  return (

    <View style={styles.container}>

      <ScrollView
        contentContainerStyle={styles.scroll}
      >

        <Text style={styles.heading}>
          Compose Broadcast
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={[
            styles.input,
            styles.textarea
          ]}
          placeholder="Message"
          multiline
          value={body}
          onChangeText={setBody}
        />

        {/* FILE PICKERS */}

        <View style={styles.uploadRow}>

          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={pickImage}
          >
            <Text style={styles.uploadText}>
              🖼 Pick Image
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={pickDocument}
          >
            <Text style={styles.uploadText}>
              📄 Pick File
            </Text>
          </TouchableOpacity>

        </View>

        {file && (

          <View style={styles.previewBox}>

            <Text style={styles.fileName}>
              {file.name || 'Selected file'}
            </Text>

            {file.mimeType?.startsWith('image') && (

              <Image
                source={{ uri: file.uri }}
                style={styles.previewImage}
              />
            )}

          </View>
        )}

        {/* SEND ALL */}

        <TouchableOpacity
          style={[
            styles.optionBtn,
            sendToAll &&
            styles.optionSelected
          ]}
          onPress={() => {

            setSendToAll(
              !sendToAll
            );

            setSelectedMembers([]);

            setSelectedGroup(null);
          }}
        >

          <Text>
            {sendToAll ? '✅' : '⬜'} Send To All
          </Text>

        </TouchableOpacity>

        {/* GROUPS */}

        {!sendToAll &&
          groups.map(g => (

          <TouchableOpacity
            key={g.id}
            style={[
              styles.optionBtn,

              selectedGroup === g.id &&
              styles.optionSelected
            ]}
            onPress={() => {

              setSelectedGroup(
                selectedGroup === g.id
                  ? null
                  : g.id
              );

              setSelectedMembers([]);
            }}
          >

            <Text>
              👥 {g.name}
            </Text>

          </TouchableOpacity>
        ))}

        {/* MEMBERS */}

        {!sendToAll &&
          !selectedGroup && (

          <>
            <Text style={styles.membersTitle}>
              Select Members
            </Text>

            {fetching ? (

              <ActivityIndicator />

            ) : (

              members.map(m => (

                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.memberRow,

                    selectedMembers.includes(m.id) &&
                    styles.optionSelected
                  ]}
                  onPress={() =>
                    toggleMember(m.id)
                  }
                >

                  <Text>
                    {m.name}
                  </Text>

                </TouchableOpacity>
              ))
            )}
          </>
        )}

        <TouchableOpacity
          style={styles.sendBtn}
          onPress={handleSend}
          disabled={loading}
        >

          {loading ? (

            <ActivityIndicator
              color="#fff"
            />

          ) : (

            <Text style={styles.sendText}>
              Send Broadcast
            </Text>
          )}

        </TouchableOpacity>

      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor:
      Colors.background
  },

  scroll: {
    padding: 16,
    paddingBottom: 40
  },

  heading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20
  },

  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd'
  },

  textarea: {
    height: 120
  },

  uploadRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },

  uploadBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center'
  },

  uploadText: {
    color: '#fff',
    fontWeight: '700'
  },

  previewBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16
  },

  fileName: {
    marginBottom: 10,
    fontWeight: '600'
  },

  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 10
  },

  optionBtn: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd'
  },

  optionSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF'
  },

  membersTitle: {
    marginTop: 10,
    marginBottom: 10,
    fontWeight: '700'
  },

  memberRow: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd'
  },

  sendBtn: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20
  },

  sendText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16
  }
});