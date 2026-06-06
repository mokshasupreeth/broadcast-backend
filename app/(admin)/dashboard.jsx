import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { BlurView } from 'expo-blur';

import { useTheme } from '../../context/ThemeContext';

import {
  deleteMessage,
  getMembers,
  getSentMessages,
} from '../../lib/api';

import {
  getAuth,
  logout,
} from '../../store/authStore';

const { width } = Dimensions.get('window');

// ─────────────────────────────────────
// GREETING
// ─────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();

  if (h < 12) return 'Morning';

  if (h < 17) return 'Afternoon';

  return 'Evening';
}

// ─────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
  delay,
}) {

  const fade =
    useRef(
      new Animated.Value(0)
    ).current;

  const scale =
    useRef(
      new Animated.Value(0.9)
    ).current;

  useEffect(() => {

    Animated.parallel([

      Animated.timing(fade, {
        toValue: 1,
        duration: 450,
        delay,
        useNativeDriver: true,
      }),

      Animated.spring(scale, {
        toValue: 1,
        tension: 70,
        friction: 8,
        delay,
        useNativeDriver: true,
      }),

    ]).start();

  }, []);

  return (

    <Animated.View
      style={[
        styles.statCard,
        {
          opacity: fade,
          transform: [{ scale }],
        },
      ]}
    >

      <BlurView
        intensity={22}
        tint="dark"
        style={styles.statBlur}
      >

        <Text style={styles.statEmoji}>
          {icon}
        </Text>

        <Text style={styles.statValue}>
          {value}
        </Text>

        <Text style={styles.statLabel}>
          {label}
        </Text>

      </BlurView>

    </Animated.View>
  );
}

// ─────────────────────────────────────
// ACTION CARD
// ─────────────────────────────────────

function ActionCard({
  emoji,
  label,
  colors,
  onPress,
  delay,
}) {

  const fade =
    useRef(
      new Animated.Value(0)
    ).current;

  const move =
    useRef(
      new Animated.Value(20)
    ).current;

  const press =
    useRef(
      new Animated.Value(1)
    ).current;

  useEffect(() => {

    Animated.parallel([

      Animated.timing(fade, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),

      Animated.spring(move, {
        toValue: 0,
        tension: 70,
        friction: 8,
        delay,
        useNativeDriver: true,
      }),

    ]).start();

  }, []);

  return (

    <Animated.View
      style={{
        opacity: fade,
        transform: [
          { translateY: move },
          { scale: press },
        ],
        width: (width - 52) / 2,
      }}
    >

      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={() => {

          Animated.spring(press, {
            toValue: 0.96,
            tension: 200,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }}
        onPressOut={() => {

          Animated.spring(press, {
            toValue: 1,
            tension: 200,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }}
      >

        <LinearGradient
          colors={colors}
          style={styles.actionCard}
        >

          <View style={styles.actionIconWrap}>
            <Text style={styles.actionEmoji}>
              {emoji}
            </Text>
          </View>

          <Text style={styles.actionLabel}>
            {label}
          </Text>

          <Text style={styles.actionArrow}>
            →
          </Text>

        </LinearGradient>

      </TouchableOpacity>

    </Animated.View>
  );
}

// ─────────────────────────────────────
// MESSAGE CARD
// ─────────────────────────────────────

function MessageCard({
  msg,
  index,
  onDelete,
  onPress,
}) {

  const fade =
    useRef(
      new Animated.Value(0)
    ).current;

  const move =
    useRef(
      new Animated.Value(-20)
    ).current;

  useEffect(() => {

    Animated.parallel([

      Animated.timing(fade, {
        toValue: 1,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),

      Animated.spring(move, {
        toValue: 0,
        tension: 70,
        friction: 8,
        delay: index * 60,
        useNativeDriver: true,
      }),

    ]).start();

  }, []);

  return (

    <Animated.View
      style={{
        opacity: fade,
        transform: [{ translateX: move }],
        marginBottom: 14,
      }}
    >

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
      >

        <BlurView
          intensity={18}
          tint="dark"
          style={styles.msgBlur}
        >

          <View style={styles.msgCard}>

            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              style={styles.msgAccent}
            />

            <View style={{ flex: 1 }}>

              <View style={styles.msgHeader}>

                <Text
                  style={styles.msgTitle}
                  numberOfLines={1}
                >
                  {msg.title}
                </Text>

                <Text style={styles.msgDate}>
                  {
                    msg.created_at
                      ? new Date(
                          msg.created_at
                        ).toLocaleDateString(
                          'en-GB',
                          {
                            day: '2-digit',
                            month: 'short',
                          }
                        )
                      : ''
                  }
                </Text>

              </View>

              <Text
                style={styles.msgBody}
                numberOfLines={2}
              >
                {msg.body}
              </Text>

              <View style={styles.msgFooter}>

                <View style={styles.readBadge}>

                  <Text style={styles.readText}>
                    👁 {msg.readCount || 0}
                  </Text>

                </View>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >

                  <LinearGradient
                    colors={[
                      '#450a0a',
                      '#7f1d1d',
                    ]}
                    style={styles.deleteBtn}
                  >

                    <Text style={styles.deleteText}>
                      Delete
                    </Text>

                  </LinearGradient>

                </TouchableOpacity>

              </View>

            </View>

          </View>

        </BlurView>

      </TouchableOpacity>

    </Animated.View>
  );
}

// ─────────────────────────────────────
// MAIN
// ─────────────────────────────────────

export default function Dashboard() {

  const {
    isDark,
    toggle,
  } = useTheme();

  const [messages, setMessages] =
    useState([]);

  const [memberCount, setMemberCount] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState('');

  const [user, setUser] =
    useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {

    try {

      const auth =
        await getAuth();

      setUser(auth.user);

      const memRes =
        await getMembers();

      const msgRes =
        await getSentMessages();

      setMemberCount(
        memRes?.data?.length || 0
      );

      setMessages(
        msgRes?.data || []
      );

    } catch (err) {

      console.log(
        'DASHBOARD ERROR:',
        err?.response?.data || err
      );

    } finally {

      setLoading(false);
    }
  };

  const filteredMessages =
    useMemo(() => {

      if (!search)
        return messages;

      return messages.filter((m) => {

        const q =
          search.toLowerCase();

        return (

          m.title
            ?.toLowerCase()
            .includes(q)

          ||

          m.body
            ?.toLowerCase()
            .includes(q)

        );
      });

    }, [messages, search]);

  const handleDelete =
    useCallback((msg) => {

      Alert.alert(
        'Delete Message',
        'Delete for everyone?',
        [

          {
            text: 'Cancel',
            style: 'cancel',
          },

          {
            text: 'Delete',
            style: 'destructive',

            onPress: async () => {

              try {

                await deleteMessage(msg.id);

                setMessages(prev =>
                  prev.filter(
                    m => m.id !== msg.id
                  )
                );

              } catch {

                Alert.alert(
                  'Error',
                  'Delete failed'
                );
              }
            },
          },
        ]
      );

    }, []);

  const handleLogout =
    async () => {

      await logout();

      router.replace('/(auth)/login');
    };

  if (loading) {

    return (

      <View style={styles.loaderWrap}>

        <LinearGradient
          colors={[
            '#09010F',
            '#0E0520',
            '#130A28',
          ]}
          style={StyleSheet.absoluteFill}
        />

        <ActivityIndicator
          size="large"
          color="#A78BFA"
        />

        <Text style={styles.loadingText}>
          Loading dashboard...
        </Text>

      </View>
    );
  }

  return (

    <View style={styles.root}>

      <StatusBar
        barStyle="light-content"
      />

      <LinearGradient
        colors={[
          '#09010F',
          '#0E0520',
          '#130A28',
        ]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor="#A78BFA"
          />
        }
        contentContainerStyle={{
          paddingBottom: 50,
        }}
      >

        {/* HEADER */}

        <BlurView
          intensity={18}
          tint="dark"
          style={styles.header}
        >

          <View style={styles.headerTop}>

            <View style={{ flex: 1 }}>

              <Text style={styles.greeting}>
                Good {getGreeting()} 👋
              </Text>

              <Text
                style={styles.adminName}
                numberOfLines={1}
              >
                {user?.name || 'Admin'}
              </Text>

            </View>

            <View style={styles.headerBtns}>

              <TouchableOpacity
                onPress={() =>
                  router.push(
                    '/(admin)/profile'
                  )
                }
              >

                <BlurView
                  intensity={25}
                  tint="dark"
                  style={styles.iconBtn}
                >

                  <Text style={{ fontSize: 18 }}>
                    👤
                  </Text>

                </BlurView>

              </TouchableOpacity>

              <TouchableOpacity
                onPress={toggle}
              >

                <BlurView
                  intensity={25}
                  tint="dark"
                  style={styles.iconBtn}
                >

                  <Text style={{ fontSize: 18 }}>
                    {isDark ? '☀️' : '🌙'}
                  </Text>

                </BlurView>

              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogout}
              >

                <LinearGradient
                  colors={[
                    '#7f1d1d',
                    '#991b1b',
                  ]}
                  style={styles.logoutBtn}
                >

                  <Text style={styles.logoutText}>
                    Logout
                  </Text>

                </LinearGradient>

              </TouchableOpacity>

            </View>

          </View>

          <View style={styles.statsRow}>

            <StatCard
              icon="👥"
              value={memberCount}
              label="Members"
              delay={100}
            />

            <StatCard
              icon="✉️"
              value={messages.length}
              label="Messages"
              delay={180}
            />

            <StatCard
              icon="📊"
              value={
                messages.filter(
                  m => m.readCount > 0
                ).length
              }
              label="Read"
              delay={260}
            />

          </View>

        </BlurView>

        {/* QUICK ACTIONS */}

        <View style={styles.sectionWrap}>

          <Text style={styles.sectionTitle}>
            QUICK ACTIONS
          </Text>

          <View style={styles.actionsGrid}>

            <ActionCard
              emoji="✉️"
              label="Send Broadcast"
              colors={[
                '#2563EB',
                '#7C3AED',
              ]}
              delay={100}
              onPress={() =>
                router.push(
                  '/(admin)/compose'
                )
              }
            />

            <ActionCard
              emoji="👥"
              label="View Members"
              colors={[
                '#059669',
                '#0D9488',
              ]}
              delay={180}
              onPress={() =>
                router.push(
                  '/(admin)/members'
                )
              }
            />

            <ActionCard
              emoji="🔔"
              label="Join Requests"
              colors={[
                '#DC2626',
                '#DB2777',
              ]}
              delay={260}
              onPress={() =>
                router.push(
                  '/(admin)/requests'
                )
              }
            />

            <ActionCard
              emoji="🗂️"
              label="Manage Groups"
              colors={[
                '#0891B2',
                '#7C3AED',
              ]}
              delay={340}
              onPress={() =>
                router.push(
                  '/(admin)/groups'
                )
              }
            />

          </View>

        </View>

        {/* SENT MESSAGES */}

        <View style={styles.sectionWrap}>

          <Text style={styles.sectionTitle}>
            SENT MESSAGES
          </Text>

          <View style={styles.searchWrap}>

            <Text style={styles.searchIcon}>
              ⌕
            </Text>

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search broadcasts..."
              placeholderTextColor="rgba(167,139,250,0.45)"
              style={styles.searchInput}
            />

          </View>

          {
            filteredMessages.length === 0

              ? (

                <BlurView
                  intensity={15}
                  tint="dark"
                  style={styles.emptyBox}
                >

                  <Text style={styles.emptyEmoji}>
                    📭
                  </Text>

                  <Text style={styles.emptyTitle}>
                    No messages
                  </Text>

                </BlurView>

              )

              : (

                <FlatList
                  data={filteredMessages}
                  scrollEnabled={false}
                  keyExtractor={(item) =>
                    String(item.id)
                  }
                  renderItem={({
                    item,
                    index,
                  }) => (

                    <MessageCard
                      msg={item}
                      index={index}
                      onDelete={() =>
                        handleDelete(item)
                      }
                      onPress={() =>
                        router.push(
                          `/(admin)/receipts?id=${item.id}&title=${encodeURIComponent(item.title)}`
                        )
                      }
                    />

                  )}
                />

              )
          }

        </View>

      </ScrollView>

    </View>
  );
}

// ─────────────────────────────────────
// STYLES
// ─────────────────────────────────────

const styles = StyleSheet.create({

  root: {
    flex: 1,
    backgroundColor: '#09010F',
  },

  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09010F',
  },

  loadingText: {
    marginTop: 14,
    color: '#C4B5FD',
  },

  orb1: {
    position: 'absolute',
    top: -80,
    right: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(124,58,237,0.18)',
  },

  orb2: {
    position: 'absolute',
    top: 200,
    left: -100,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },

  header: {
    paddingTop:
      Platform.OS === 'ios'
        ? 58
        : 44,

    paddingHorizontal: 20,
    paddingBottom: 22,

    borderBottomWidth: 1,

    borderBottomColor:
      'rgba(167,139,250,0.08)',
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  greeting: {
    fontSize: 12,
    color: 'rgba(167,139,250,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  adminName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginTop: 3,
  },

  headerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor:
      'rgba(167,139,250,0.15)',
  },

  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },

  logoutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  statCard: {
    flex: 1,
  },

  statBlur: {
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor:
      'rgba(167,139,250,0.12)',
  },

  statEmoji: {
    fontSize: 22,
    marginBottom: 8,
  },

  statValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },

  statLabel: {
    marginTop: 4,
    fontSize: 10,
    color: 'rgba(167,139,250,0.55)',
    textTransform: 'uppercase',
  },

  sectionWrap: {
    paddingHorizontal: 16,
    marginTop: 28,
  },

  sectionTitle: {
    color: 'rgba(167,139,250,0.7)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 16,
  },

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  actionCard: {
    padding: 20,
    borderRadius: 22,
    minHeight: 120,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
  },

  actionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor:
      'rgba(255,255,255,0.14)',

    justifyContent: 'center',
    alignItems: 'center',

    marginBottom: 14,
  },

  actionEmoji: {
    fontSize: 22,
  },

  actionLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  actionArrow: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      'rgba(20,8,45,0.55)',

    borderWidth: 1,

    borderColor:
      'rgba(167,139,250,0.10)',

    borderRadius: 16,

    paddingHorizontal: 14,

    marginBottom: 18,
  },

  searchIcon: {
    color: 'rgba(167,139,250,0.55)',
    fontSize: 18,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 13,
    fontSize: 14,
  },

  msgBlur: {
    borderRadius: 20,
    overflow: 'hidden',

    borderWidth: 1,

    borderColor:
      'rgba(167,139,250,0.10)',
  },

  msgCard: {
    flexDirection: 'row',

    backgroundColor:
      'rgba(20,8,45,0.55)',

    padding: 16,
    gap: 14,
  },

  msgAccent: {
    width: 3,
    borderRadius: 3,
  },

  msgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  msgTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },

  msgDate: {
    color: 'rgba(167,139,250,0.45)',
    fontSize: 11,
  },

  msgBody: {
    color: 'rgba(220,210,240,0.7)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },

  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  readBadge: {
    backgroundColor:
      'rgba(167,139,250,0.12)',

    paddingHorizontal: 10,
    paddingVertical: 5,

    borderRadius: 20,
  },

  readText: {
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: '700',
  },

  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginLeft: 'auto',
  },

  deleteText: {
    color: '#FCA5A5',
    fontWeight: '700',
    fontSize: 12,
  },

  emptyBox: {
    padding: 40,
    alignItems: 'center',
    borderRadius: 20,
    overflow: 'hidden',
  },

  emptyEmoji: {
    fontSize: 52,
    marginBottom: 12,
  },

  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

});