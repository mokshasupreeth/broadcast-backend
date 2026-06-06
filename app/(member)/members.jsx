// members.jsx — Professional Clean UI
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList,
  RefreshControl, StyleSheet, Text,
  TextInput, TouchableOpacity, View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { getAuth } from '../../store/authStore';

const COLORS = [
  '#3b82f6','#8b5cf6','#ec4899',
  '#10b981','#f59e0b','#ef4444',
];

function MemberRow({ item, colorIndex, onPress }) {
  const color    = COLORS[colorIndex % COLORS.length];
  const name     = item?.name || item?.email || 'Unknown';
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  return (
    <TouchableOpacity style={s.row} onPress={() => onPress(item)} activeOpacity={0.6}>
      {/* Avatar */}
      <View style={[s.avatar, { backgroundColor: color + '20', borderColor: color + '40' }]}>
        <Text style={[s.avatarText, { color }]}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={s.memberName} numberOfLines={1}>{name}</Text>
        <Text style={s.memberSub} numberOfLines={1}>
          {item?.about || item?.email || 'Tap to message'}
        </Text>
      </View>

      {/* Online dot + chevron */}
      <View style={s.rowRight}>
        <View style={[s.dot, { backgroundColor: item?.is_online ? '#22c55e' : '#d1d5db' }]} />
        <Text style={s.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function Members() {
  const { isDark } = useTheme();
  const [members, setMembers]           = useState([]);
  const [filtered, setFiltered]         = useState([]);
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [myId, setMyId]                 = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const C = isDark ? DARK : LIGHT;

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { user } = await getAuth();
    setMyId(user.id);
    fetchMembers(user.id);
  };

  const fetchMembers = async (uid) => {
    try {
      const res  = await api.get('/api/chat/users');
      const data = (res.data || []).filter(m => m && m.id && String(m.id) !== String(uid));
      setMembers(data);
      setFiltered(data);
    } catch { Alert.alert('Error', 'Could not load members'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = useCallback(() => { setRefreshing(true); fetchMembers(myId); }, [myId]);

  const applyFilter = (text, filter, list) => {
    let r = [...list];
    if (filter === 'online')  r = r.filter(m => m.is_online);
    if (filter === 'offline') r = r.filter(m => !m.is_online);
    if (text) {
      const q = text.toLowerCase();
      r = r.filter(m => m?.name?.toLowerCase().includes(q) || m?.email?.toLowerCase().includes(q));
    }
    setFiltered(r);
  };

  const handleSearch = (t) => { setSearch(t); applyFilter(t, activeFilter, members); };
  const handleFilter = (f) => { setActiveFilter(f); applyFilter(search, f, members); };

  const startChat = async (member) => {
    try {
      const res = await api.post('/api/chat/chats', { otherUserId: member.id });
      router.push({
        pathname: '/(member)/private-chat',
        params: { chatId: res.data.id, otherName: member.name || 'Unknown', otherId: member.id }
      });
    } catch { Alert.alert('Error', 'Could not start chat'); }
  };

  const onlineCount  = members.filter(m => m.is_online).length;
  const offlineCount = members.length - onlineCount;

  const TABS = [
    { key: 'all',     label: `All (${members.length})` },
    { key: 'online',  label: `Online (${onlineCount})` },
    { key: 'offline', label: `Offline (${offlineCount})` },
  ];

  return (
    <View style={[s.screen, { backgroundColor: C.bg }]}>

      {/* ── Top bar ── */}
      <View style={[s.topbar, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <View>
          <Text style={[s.topbarTitle, { color: C.text }]}>Members</Text>
          <Text style={[s.topbarSub, { color: C.muted }]}>
            {members.length} people · {onlineCount} online
          </Text>
        </View>
        <TouchableOpacity
          style={[s.newChatBtn, { backgroundColor: C.accent + '15', borderColor: C.accent + '30' }]}
          onPress={() => router.push('/(member)/members')}
        >
          <Text style={[s.newChatText, { color: C.accent }]}>✏️ New</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={[s.searchWrap, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <View style={[s.searchBox, { backgroundColor: C.bg, borderColor: C.border }]}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={[s.searchInput, { color: C.text }]}
            placeholder="Search by name or email..."
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Text style={{ color: C.muted, fontSize: 15 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter tabs */}
        <View style={s.tabs}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[
                s.tab,
                { borderColor: C.border },
                activeFilter === t.key && { backgroundColor: C.accent, borderColor: C.accent }
              ]}
              onPress={() => handleFilter(t.key)}
            >
              <Text style={[
                s.tabText,
                { color: activeFilter === t.key ? '#fff' : C.muted }
              ]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── List ── */}
      {loading ? (
        <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <MemberRow item={item} colorIndex={index} onPress={startChat} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View style={[s.separator, { backgroundColor: C.border, marginLeft: 72 }]} />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>👥</Text>
              <Text style={[s.emptyTitle, { color: C.text }]}>No members found</Text>
              <Text style={[s.emptyText, { color: C.muted }]}>Try a different search or filter</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

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

const s = StyleSheet.create({
  screen:       { flex: 1 },

  // Topbar
  topbar:       { paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20, borderBottomWidth: 0.5, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  topbarTitle:  { fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  topbarSub:    { fontSize: 12, marginTop: 2 },
  newChatBtn:   { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  newChatText:  { fontSize: 13, fontWeight: '600' },

  // Search
  searchWrap:   { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 0.5 },
  searchBox:    { flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  searchIcon:   { fontSize: 14, marginRight: 8 },
  searchInput:  { flex: 1, paddingVertical: 10, fontSize: 14 },
  tabs:         { flexDirection: 'row', gap: 8 },
  tab:          { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5 },
  tabText:      { fontSize: 12, fontWeight: '500' },

  // Rows
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  avatar:       { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatarText:   { fontSize: 15, fontWeight: '700' },
  memberName:   { fontSize: 15, fontWeight: '500', color: '#111', marginBottom: 2 },
  memberSub:    { fontSize: 12, color: '#8e8e93' },
  rowRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:          { width: 8, height: 8, borderRadius: 4 },
  chevron:      { fontSize: 20, color: '#c7c7cc', fontWeight: '300' },
  separator:    { height: 0.5 },

  // Empty
  empty:        { alignItems: 'center', marginTop: 80 },
  emptyEmoji:   { fontSize: 44, marginBottom: 12 },
  emptyTitle:   { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  emptyText:    { fontSize: 14 },
});