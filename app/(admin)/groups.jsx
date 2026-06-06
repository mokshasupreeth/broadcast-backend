import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import {
  addMemberToGroup,
  createGroup,
  deleteGroup,
  getGroups,
  getMembers,
  removeMemberFromGroup
} from '../../lib/api';

const { width } = Dimensions.get('window');

export default function Groups() {
  const { colors, isDark } = useTheme();

  const [groups, setGroups] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [addingMemberId, setAddingMemberId] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [grpRes, memRes] = await Promise.all([
        getGroups(),
        getMembers()
      ]);
      console.log('✅ Groups:', JSON.stringify(grpRes.data));
      console.log('✅ Members:', memRes.data?.length, 'members loaded');
      setGroups(grpRes.data || []);
      setAllMembers(memRes.data || []);
    } catch (err) {
      console.log('❌ loadData error:', err?.response?.status, JSON.stringify(err?.response?.data));
      Alert.alert(
        'Error',
        `${err?.response?.status || ''} ${err?.response?.data?.error || err?.message || 'Could not load data'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Validation', 'Group name is required');
      return;
    }
    try {
      setCreating(true);
      const res = await createGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim()
      });
      console.log('✅ Created group:', JSON.stringify(res.data));
      const newGroup = {
        id: res.data.id,
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        members: []
      };
      setGroups(prev => [newGroup, ...prev]);
      setNewGroupName('');
      setNewGroupDesc('');
      setCreateModalVisible(false);
      Alert.alert('Success', 'Group created successfully!');
    } catch (err) {
      console.log('❌ Create error:', err?.response?.status, JSON.stringify(err?.response?.data));
      Alert.alert(
        'Error',
        `${err?.response?.status || 'Network Error'}: ${err?.response?.data?.error || err?.message || 'Failed to create group'}`
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = (group) => {
    Alert.alert(
      'Delete Group',
      `Delete "${group.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGroup(group.id);
              setGroups(prev => prev.filter(g => g.id !== group.id));
              if (expandedGroup === group.id) setExpandedGroup(null);
            } catch (err) {
              console.log('❌ Delete error:', err?.response?.status, JSON.stringify(err?.response?.data));
              Alert.alert('Error', err?.response?.data?.error || 'Failed to delete group');
            }
          }
        }
      ]
    );
  };

  const handleAddMember = async (member) => {
    if (!selectedGroup) return;
    try {
      setAddingMemberId(member.id);
      await addMemberToGroup(selectedGroup.id, member.id);
      const updatedMembers = [...(selectedGroup.members || []), member];
      setGroups(prev =>
        prev.map(g =>
          g.id === selectedGroup.id
            ? { ...g, members: updatedMembers }
            : g
        )
      );
      setSelectedGroup(prev => ({ ...prev, members: updatedMembers }));
      Alert.alert('✅ Added', `${member.name} added to "${selectedGroup.name}"`);
    } catch (err) {
      console.log('❌ Add member error:', err?.response?.status, JSON.stringify(err?.response?.data));
      Alert.alert(
        'Error',
        `${err?.response?.status || 'Network Error'}: ${err?.response?.data?.error || err?.message || 'Failed to add member'}`
      );
    } finally {
      setAddingMemberId(null);
    }
  };

  const handleRemoveMember = (group, member) => {
    Alert.alert(
      'Remove Member',
      `Remove ${member.name} from "${group.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMemberFromGroup(group.id, member.id);
              setGroups(prev =>
                prev.map(g =>
                  g.id === group.id
                    ? { ...g, members: (g.members || []).filter(m => m.id !== member.id) }
                    : g
                )
              );
            } catch (err) {
              console.log('❌ Remove error:', err?.response?.status, JSON.stringify(err?.response?.data));
              Alert.alert('Error', err?.response?.data?.error || 'Failed to remove member');
            }
          }
        }
      ]
    );
  };

  const getAvailableMembers = () => {
    if (!selectedGroup) return allMembers;
    const existingIds = new Set((selectedGroup.members || []).map(m => m.id));
    const available = allMembers.filter(m => !existingIds.has(m.id));
    if (!memberSearch.trim()) return available;
    const q = memberSearch.toLowerCase();
    return available.filter(
      m =>
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q)
    );
  };

  const totalAssigned = groups.reduce(
    (sum, g) => sum + (g.members?.length || 0), 0
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── Header ── */}
      <LinearGradient
        colors={isDark ? ['#0C4A6E', '#1E293B'] : ['#0891B2', '#06B6D4']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Groups</Text>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setCreateModalVisible(true)}
          >
            <Text style={styles.createBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{groups.length}</Text>
            <Text style={styles.statLabel}>Groups</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{allMembers.length}</Text>
            <Text style={styles.statLabel}>All Members</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{totalAssigned}</Text>
            <Text style={styles.statLabel}>Assigned</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 40 }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {groups.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
              <Text style={styles.emptyEmoji}>🗂️</Text>
              <Text style={[styles.emptyText, { color: colors.textLight }]}>
                No groups yet.{'\n'}Tap "+ New" to create your first group.
              </Text>
            </View>
          ) : (
            groups.map(group => {
              const isExpanded = expandedGroup === group.id;
              const members = group.members || [];
              return (
                <View
                  key={group.id}
                  style={[styles.groupCard, { backgroundColor: colors.card }]}
                >
                  <TouchableOpacity
                    style={styles.groupRow}
                    onPress={() => setExpandedGroup(isExpanded ? null : group.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.groupLeft}>
                      <View style={styles.groupIconWrap}>
                        <Text style={styles.groupIconText}>🗂️</Text>
                      </View>
                      <View style={styles.groupMeta}>
                        <Text style={[styles.groupName, { color: colors.text }]}>
                          {group.name}
                        </Text>
                        {!!group.description && (
                          <Text style={[styles.groupDesc, { color: colors.textLight }]}>
                            {group.description}
                          </Text>
                        )}
                        <Text style={[styles.groupCount, { color: colors.gray }]}>
                          {members.length} member{members.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.groupRight}>
                      <TouchableOpacity
                        style={[styles.addBtn, { backgroundColor: '#0891B215' }]}
                        onPress={() => {
                          setSelectedGroup(group);
                          setMemberSearch('');
                          setAddMemberModalVisible(true);
                        }}
                      >
                        <Text style={[styles.addBtnText, { color: '#0891B2' }]}>
                          + Add
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.delBtn, { backgroundColor: colors.danger + '15' }]}
                        onPress={() => handleDeleteGroup(group)}
                      >
                        <Text style={{ fontSize: 14 }}>🗑</Text>
                      </TouchableOpacity>
                      <Text style={[styles.chevron, { color: colors.gray }]}>
                        {isExpanded ? '▲' : '▼'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[styles.memberList, { borderTopColor: colors.border || '#eee' }]}>
                      {members.length === 0 ? (
                        <Text style={[styles.noMembers, { color: colors.textLight }]}>
                          No members yet — tap "+ Add" above.
                        </Text>
                      ) : (
                        members.map((member, idx) => (
                          <View
                            key={member.id}
                            style={[
                              styles.memberRow,
                              {
                                borderBottomColor: colors.border || '#f0f0f0',
                                borderBottomWidth: idx < members.length - 1 ? 1 : 0
                              }
                            ]}
                          >
                            <View style={[styles.avatar, { backgroundColor: '#0891B220' }]}>
                              <Text style={styles.avatarText}>
                                {member.name?.[0]?.toUpperCase() || '?'}
                              </Text>
                            </View>
                            <View style={styles.memberInfo}>
                              <Text style={[styles.memberName, { color: colors.text }]}>
                                {member.name}
                              </Text>
                              <Text style={[styles.memberEmail, { color: colors.textLight }]}>
                                {member.email}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.removeBtn, { backgroundColor: colors.danger + '15' }]}
                              onPress={() => handleRemoveMember(group, member)}
                            >
                              <Text style={[styles.removeBtnText, { color: colors.danger }]}>
                                Remove
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ══════════════════════════════
          Create Group Modal
      ══════════════════════════════ */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              Create New Group
            </Text>

            <Text style={[styles.label, { color: colors.textLight }]}>
              Group Name *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border || '#ddd'
                }
              ]}
              placeholder="e.g. Engineering Team"
              placeholderTextColor={colors.gray}
              value={newGroupName}
              onChangeText={setNewGroupName}
            />

            <Text style={[styles.label, { color: colors.textLight }]}>
              Description (optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.inputMulti,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border || '#ddd'
                }
              ]}
              placeholder="What is this group for?"
              placeholderTextColor={colors.gray}
              value={newGroupDesc}
              onChangeText={setNewGroupDesc}
              multiline
              numberOfLines={3}
            />

            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border || '#ddd' }]}
                onPress={() => {
                  setCreateModalVisible(false);
                  setNewGroupName('');
                  setNewGroupDesc('');
                }}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textLight }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleCreateGroup}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════
          Add Member Modal
      ══════════════════════════════ */}
      <Modal
        visible={addMemberModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddMemberModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, styles.sheetTall, { backgroundColor: colors.card }]}>

            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.text, marginBottom: 2 }]}>
                  Add Members
                </Text>
                <Text style={[styles.sheetSub, { color: colors.textLight }]}>
                  {selectedGroup?.name} • {getAvailableMembers().length} available
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAddMemberModalVisible(false)}
                style={styles.closeBtn}
              >
                <Text style={[styles.closeBtnText, { color: colors.gray }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border || '#ddd'
                }
              ]}
              placeholder="🔍  Search by name or email..."
              placeholderTextColor={colors.gray}
              value={memberSearch}
              onChangeText={setMemberSearch}
            />

            {allMembers.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyEmoji}>👥</Text>
                <Text style={[styles.modalEmptyText, { color: colors.textLight }]}>
                  No members found.
                </Text>
              </View>
            ) : getAvailableMembers().length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyEmoji}>✅</Text>
                <Text style={[styles.modalEmptyText, { color: colors.textLight }]}>
                  {memberSearch.trim()
                    ? 'No members match your search.'
                    : 'All members are already in this group.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={getAvailableMembers()}
                keyExtractor={item => String(item.id)}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: member }) => {
                  const isAdding = addingMemberId === member.id;
                  return (
                    <View
                      style={[
                        styles.selectRow,
                        { borderBottomColor: colors.border || '#f0f0f0' }
                      ]}
                    >
                      <View style={[styles.avatar, { backgroundColor: '#0891B220' }]}>
                        <Text style={styles.avatarText}>
                          {member.name?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { color: colors.text }]}>
                          {member.name}
                        </Text>
                        <Text style={[styles.memberEmail, { color: colors.textLight }]}>
                          {member.email}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.addChip, isAdding && styles.addChipLoading]}
                        onPress={() => handleAddMember(member)}
                        disabled={!!addingMemberId}
                      >
                        {isAdding ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.addChipText}>+ Add</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 20
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10
  },
  backText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  headerTitle: { color: '#fff', fontWeight: '800', fontSize: 18 },
  createBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },

  scroll: { padding: 16, paddingBottom: 40 },

  emptyCard: {
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    marginTop: 20
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  groupCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14
  },
  groupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12
  },
  groupIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0891B215',
    alignItems: 'center',
    justifyContent: 'center'
  },
  groupIconText: { fontSize: 20 },
  groupMeta: { flex: 1 },
  groupName: { fontSize: 15, fontWeight: '700' },
  groupDesc: { fontSize: 12, marginTop: 2 },
  groupCount: { fontSize: 11, marginTop: 3 },
  groupRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  addBtnText: { fontSize: 12, fontWeight: '700' },
  delBtn: { padding: 6, borderRadius: 8 },
  chevron: { fontSize: 11 },

  memberList: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  noMembers: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#0891B2' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberEmail: { fontSize: 12, marginTop: 1 },
  removeBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  removeBtnText: { fontSize: 12, fontWeight: '600' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40
  },
  sheetTall: { maxHeight: '80%' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  sheetSub: { fontSize: 12 },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18 },

  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 16
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12
  },

  sheetBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center'
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#0891B2',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center'
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10
  },
  addChip: {
    backgroundColor: '#0891B2',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center'
  },
  addChipLoading: { backgroundColor: '#0891B280' },
  addChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  modalEmpty: { alignItems: 'center', paddingVertical: 40 },
  modalEmptyEmoji: { fontSize: 40, marginBottom: 10 },
  modalEmptyText: { fontSize: 14, textAlign: 'center' }
});