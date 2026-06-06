// settings.jsx — Professional Clean UI
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert, Image, ScrollView, StyleSheet,
  Switch, Text, TextInput,
  TouchableOpacity, View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { disconnectSocket } from '../../services/socket';
import { clearAuth, getAuth } from '../../store/authStore';

const BASE_URL = 'https://broadcast-backend-mxyr.onrender.com';

export default function Settings() {
  const { isDark, toggle } = useTheme();
  const [user, setUser]                 = useState(null);
  const [profile, setProfile]           = useState(null);
  const [editingName, setEditingName]   = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [name, setName]                 = useState('');
  const [about, setAbout]               = useState('');
  const [saving, setSaving]             = useState(false);
  const [avatarUri, setAvatarUri]       = useState(null);

  const C = isDark ? DARK : LIGHT;

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    const { user } = await getAuth();
    setUser(user);
    try {
      const res = await api.get('/api/chat/profile');
      setProfile(res.data);
      setName(res.data.name || '');
      setAbout(res.data.about || '');
      if (res.data.avatar_url) {
        const url = res.data.avatar_url.startsWith('http')
          ? res.data.avatar_url
          : `${BASE_URL}${res.data.avatar_url}`;
        setAvatarUri(url);
      }
    } catch (e) { console.log('Profile load error:', e.message); }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.put('/api/chat/profile', { name, about });
      setEditingName(false);
      setEditingAbout(false);
      Alert.alert('Saved', 'Profile updated successfully.');
      loadProfile();
    } catch { Alert.alert('Error', 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!result.canceled) {
      const file = result.assets[0];
      setAvatarUri(file.uri);
      const formData = new FormData();
      formData.append('avatar', { uri: file.uri, name: 'avatar.jpg', type: 'image/jpeg' });
      try {
        await api.post('/api/chat/profile/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        Alert.alert('Done', 'Avatar updated.');
        loadProfile();
      } catch { Alert.alert('Error', 'Failed to upload.'); setAvatarUri(null); }
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => { disconnectSocket(); await clearAuth(); router.replace('/(auth)/login'); }
      }
    ]);
  };

  return (
    <View style={[s.screen, { backgroundColor: C.bg }]}>

      {/* ── Top bar ── */}
      <View style={[s.topbar, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <Text style={[s.topbarTitle, { color: C.text }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Profile section ── */}
        <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
          {/* Avatar row */}
          <View style={[s.avatarRow, { borderBottomColor: C.border }]}>
            <TouchableOpacity onPress={pickAvatar} style={s.avatarTap}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={s.avatar}
                  onError={() => setAvatarUri(null)}
                />
              ) : (
                <View style={[s.avatarFallback, { backgroundColor: C.accent }]}>
                  <Text style={s.avatarInitial}>{name?.[0]?.toUpperCase() || '?'}</Text>
                </View>
              )}
              <View style={[s.cameraBadge, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={s.cameraIcon}>📷</Text>
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[s.profileName, { color: C.text }]}>{name || '—'}</Text>
              <Text style={[s.profileEmail, { color: C.muted }]}>{profile?.email || user?.email || '—'}</Text>
            </View>
          </View>

          {/* Name */}
          <View style={[s.fieldRow, { borderBottomColor: C.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: C.muted }]}>Display Name</Text>
              {editingName ? (
                <TextInput
                  style={[s.fieldInput, { color: C.text, borderBottomColor: C.accent }]}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={saveProfile}
                />
              ) : (
                <Text style={[s.fieldValue, { color: C.text }]}>{name || '—'}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[s.actionBtn, { borderColor: C.border }]}
              onPress={() => editingName ? saveProfile() : setEditingName(true)}
            >
              <Text style={[s.actionBtnText, { color: C.accent }]}>
                {editingName ? (saving ? 'Saving…' : 'Save') : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* About */}
          <View style={[s.fieldRow, { borderBottomColor: C.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: C.muted }]}>About</Text>
              {editingAbout ? (
                <TextInput
                  style={[s.fieldInput, { color: C.text, borderBottomColor: C.accent }]}
                  value={about}
                  onChangeText={setAbout}
                  autoFocus
                  multiline
                />
              ) : (
                <Text style={[s.fieldValue, { color: C.text }]}>{about || 'Hey there!'}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[s.actionBtn, { borderColor: C.border }]}
              onPress={() => editingAbout ? saveProfile() : setEditingAbout(true)}
            >
              <Text style={[s.actionBtnText, { color: C.accent }]}>
                {editingAbout ? (saving ? 'Saving…' : 'Save') : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email */}
          <View style={s.fieldRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: C.muted }]}>Email</Text>
              <Text style={[s.fieldValue, { color: C.text }]}>{profile?.email || user?.email || '—'}</Text>
            </View>
          </View>
        </View>

        {/* ── Preferences ── */}
        <Text style={[s.section, { color: C.muted }]}>PREFERENCES</Text>
        <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={[s.row, { borderBottomColor: C.border }]}>
            <View style={[s.rowIcon, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
              <Text>{isDark ? '☀️' : '🌙'}</Text>
            </View>
            <Text style={[s.rowLabel, { color: C.text }]}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggle}
              trackColor={{ false: '#d1d5db', true: C.accent }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* ── Account ── */}
        <Text style={[s.section, { color: C.muted }]}>ACCOUNT</Text>
        <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
          <TouchableOpacity
            style={[s.row, { borderBottomColor: C.border }]}
            onPress={() => router.push('/(auth)/forgot')}
          >
            <View style={[s.rowIcon, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
              <Text>🔑</Text>
            </View>
            <Text style={[s.rowLabel, { color: C.text }]}>Change Password</Text>
            <Text style={[s.chevron, { color: C.muted }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.row} onPress={handleLogout}>
            <View style={[s.rowIcon, { backgroundColor: '#fef2f2' }]}>
              <Text>🚪</Text>
            </View>
            <Text style={[s.rowLabel, { color: '#ef4444' }]}>Sign Out</Text>
            <Text style={[s.chevron, { color: C.muted }]}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={[s.version, { color: C.muted }]}>Broadcast v3.0</Text>
      </ScrollView>
    </View>
  );
}

// ── Theme tokens ─────────────────────────────────────────────────────────────
const DARK = {
  bg:      '#111111',
  surface: '#1c1c1e',
  border:  '#2c2c2e',
  text:    '#f5f5f5',
  muted:   '#8e8e93',
  accent:  '#3b82f6',
};
const LIGHT = {
  bg:      '#f2f2f7',
  surface: '#ffffff',
  border:  '#e5e5ea',
  text:    '#111111',
  muted:   '#8e8e93',
  accent:  '#2563eb',
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:         { flex: 1 },
  topbar:         { paddingTop: 56, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 0.5 },
  topbarTitle:    { fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  scroll:         { padding: 16, paddingBottom: 48 },

  section:        { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 24, marginBottom: 8, marginLeft: 4 },

  card:           { borderRadius: 12, borderWidth: 0.5, overflow: 'hidden', marginBottom: 4 },

  // Avatar row
  avatarRow:      { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, borderBottomWidth: 0.5 },
  avatarTap:      { position: 'relative' },
  avatar:         { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  avatarInitial:  { color: '#fff', fontSize: 22, fontWeight: '700' },
  cameraBadge:    { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cameraIcon:     { fontSize: 11 },
  profileName:    { fontSize: 16, fontWeight: '600' },
  profileEmail:   { fontSize: 13, marginTop: 2 },

  // Fields
  fieldRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5 },
  fieldLabel:     { fontSize: 11, fontWeight: '500', marginBottom: 3, letterSpacing: 0.2 },
  fieldValue:     { fontSize: 15 },
  fieldInput:     { fontSize: 15, borderBottomWidth: 1.5, paddingBottom: 2, paddingTop: 0, minWidth: 160 },
  actionBtn:      { borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 5 },
  actionBtnText:  { fontSize: 13, fontWeight: '600' },

  // List rows
  row:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12, borderBottomWidth: 0.5 },
  rowIcon:        { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  rowLabel:       { flex: 1, fontSize: 15 },
  chevron:        { fontSize: 20, fontWeight: '300' },

  version:        { textAlign: 'center', fontSize: 12, marginTop: 32 },
});