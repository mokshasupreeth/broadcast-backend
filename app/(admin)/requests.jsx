import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import {
  approveRequest,
  getJoinRequests,
  rejectRequest
} from '../../lib/api';

export default function Requests() {
  const { colors, isDark } = useTheme();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await getJoinRequests();

      setRequests(res.data || []);
    } catch {
      Alert.alert(
        'Error',
        'Could not load requests'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = (req) => {
    Alert.alert(
      'Approve Member',
      `Approve ${req.name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await approveRequest(req.id);

              setRequests(prev =>
                prev.filter(r => r.id !== req.id)
              );

              Alert.alert(
                '✅ Approved',
                `${req.name} can now login`
              );
            } catch (err) {
              Alert.alert(
                'Error',
                err.response?.data?.error ||
                  'Failed to approve'
              );
            }
          }
        }
      ]
    );
  };

  const handleReject = (req) => {
    Alert.alert(
      'Reject Member',
      `Reject ${req.name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectRequest(req.id);

              setRequests(prev =>
                prev.filter(r => r.id !== req.id)
              );

              Alert.alert(
                '❌ Rejected',
                `${req.name} has been rejected`
              );
            } catch (err) {
              Alert.alert(
                'Error',
                err.response?.data?.error ||
                  'Failed to reject'
              );
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card }
      ]}
    >
      <View style={styles.cardTop}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.primary }
          ]}
        >
          <Text style={styles.avatarText}>
            {item.name?.[0]?.toUpperCase()}
          </Text>
        </View>

        <View style={styles.info}>
          <Text
            style={[
              styles.name,
              { color: colors.text }
            ]}
          >
            {item.name}
          </Text>

          <Text
            style={[
              styles.email,
              { color: colors.textLight }
            ]}
          >
            {item.email}
          </Text>

          <Text
            style={[
              styles.username,
              { color: colors.gray }
            ]}
          >
            @{item.username}
          </Text>
        </View>

        <View
          style={[
            styles.pendingBadge,
            { backgroundColor: '#FEF3C7' }
          ]}
        >
          <Text style={styles.pendingText}>
            Pending
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.requestedAt,
          { color: colors.gray }
        ]}
      >
        Requested:{' '}
        {new Date(
          item.requested_at
        ).toLocaleDateString()}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.rejectBtn,
            { borderColor: colors.danger }
          ]}
          onPress={() => handleReject(item)}
        >
          <Text
            style={[
              styles.rejectText,
              { color: colors.danger }
            ]}
          >
            ✕ Reject
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.approveBtn}
          onPress={() => handleApprove(item)}
        >
          <LinearGradient
            colors={['#059669', '#10B981']}
            style={styles.approveBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.approveText}>
              ✓ Approve
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background }
      ]}
    >
      <LinearGradient
        colors={
          isDark
            ? ['#1E3A8A', '#1E293B']
            : ['#1D4ED8', '#7C3AED']
        }
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>
            ← Back
          </Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Join Requests
        </Text>

        <Text style={styles.headerSub}>
          {requests.length} pending approval
        </Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchRequests();
              }}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 40
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>
                🎉
              </Text>

              <Text
                style={[
                  styles.emptyTitle,
                  { color: colors.text }
                ]}
              >
                All caught up!
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  { color: colors.textLight }
                ]}
              >
                No pending requests
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  header: {
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 20
  },

  backBtn: {
    marginBottom: 12
  },

  backText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '600'
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff'
  },

  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4
  },

  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },

  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18
  },

  info: {
    flex: 1
  },

  name: {
    fontSize: 15,
    fontWeight: '700'
  },

  email: {
    fontSize: 12,
    marginTop: 2
  },

  username: {
    fontSize: 12,
    marginTop: 1
  },

  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20
  },

  pendingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E'
  },

  requestedAt: {
    fontSize: 11,
    marginBottom: 12
  },

  actions: {
    flexDirection: 'row',
    gap: 10
  },

  rejectBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center'
  },

  rejectText: {
    fontWeight: '700',
    fontSize: 14
  },

  approveBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden'
  },

  approveBtnGradient: {
    paddingVertical: 12,
    alignItems: 'center'
  },

  approveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14
  },

  emptyBox: {
    alignItems: 'center',
    marginTop: 80
  },

  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8
  },

  emptyText: {
    fontSize: 14
  }
});