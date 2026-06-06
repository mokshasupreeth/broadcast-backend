import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import {
  router,
  useFocusEffect
} from 'expo-router';

import Colors from '../../constants/colors';

import {
  getMyGroups
} from '../../lib/api';

export default function GroupsScreen() {

  const [groups, setGroups] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [])
  );

  const loadGroups = async () => {

    try {

      const res =
        await getMyGroups();

      setGroups(res.data || []);

    } catch (err) {

      console.log(
        'GROUP ERROR:',
        err.response?.data || err.message
      );

    } finally {

      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {

    setRefreshing(true);

    loadGroups();
  };

  if (loading) {

    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={Colors.primary}
        />
      </View>
    );
  }

  return (

    <View style={styles.container}>

      <Text style={styles.title}>
        My Groups
      </Text>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}

        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }

        ListEmptyComponent={() => (

          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              No groups available
            </Text>
          </View>

        )}

        renderItem={({ item }) => (

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.card}

            onPress={() =>
              router.push({
                pathname: '/group-chat',

                params: {
                  groupId: item.id,
                  groupName: item.name,
                },
              })
            }
          >

            <Text style={styles.groupName}>
              {item.name}
            </Text>

            <Text style={styles.memberCount}>
              {item.members?.length || 0}
              {' '}
              members
            </Text>

          </TouchableOpacity>

        )}
      />

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor:
      Colors.background,
    padding: 20,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,

    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  groupName: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },

  memberCount: {
    fontSize: 14,
    color: 'gray',
  },

  emptyWrap: {
    marginTop: 100,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 16,
    color: 'gray',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

});