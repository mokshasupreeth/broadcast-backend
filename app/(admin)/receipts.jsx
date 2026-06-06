import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { useTheme } from '../../context/ThemeContext';

import api from '../../lib/api';

export default function Receipts() {

  const { colors, isDark } = useTheme();

  const { id, title } =
    useLocalSearchParams();

  const [receipts, setReceipts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {

    console.log(
      'PARAMS:',
      id,
      title
    );

    if (id) {
      fetchReceipts();
    } else {
      setLoading(false);
    }

  }, [id]);

  const fetchReceipts =
    async () => {

      try {

        console.log(
          'Calling API with id:',
          id
        );

        const res =
          await api.get(
            `/api/admin/messages/${id}/receipts`
          );

        console.log(
          'Got receipts:',
          res.data?.length
        );

        setReceipts(
          res.data || []
        );

      } catch (err) {

        console.log(
          'Error:',
          err.response?.data ||
          err.message
        );

        setReceipts([]);

      } finally {

        setLoading(false);

      }
    };

  const readCount =
    receipts.filter(
      r => r.read_at
    ).length;

  const deliveredCount =
    receipts.length;

  const renderItem =
    ({ item }) => (

      <View
        style={[
          styles.card,
          {
            backgroundColor:
              colors.card
          }
        ]}
      >

        <View
          style={[
            styles.avatar,
            {
              backgroundColor:
                item.read_at
                  ? colors.success
                  : colors.lightGray
            }
          ]}
        >
          <Text
            style={styles.avatarText}
          >
            {item.name?.[0]
              ?.toUpperCase()}
          </Text>
        </View>

        <View style={styles.info}>

          <Text
            style={[
              styles.name,
              {
                color:
                  colors.text
              }
            ]}
          >
            {item.name}
          </Text>

          <Text
            style={[
              styles.email,
              {
                color:
                  colors.textLight
              }
            ]}
          >
            {item.email}
          </Text>

          {item.read_at ? (

            <Text
              style={[
                styles.readTime,
                {
                  color:
                    colors.success
                }
              ]}
            >
              ✅ Read at{' '}
              {new Date(
                item.read_at
              ).toLocaleString()}
            </Text>

          ) : (

            <Text
              style={[
                styles.readTime,
                {
                  color:
                    colors.gray
                }
              ]}
            >
              ⏳ Not read yet
            </Text>

          )}

        </View>

      </View>
    );

  return (

    <View
      style={[
        styles.container,
        {
          backgroundColor:
            colors.background
        }
      ]}
    >

      <LinearGradient
        colors={
          isDark
            ? [
                '#1E3A8A',
                '#1E293B'
              ]
            : [
                '#1D4ED8',
                '#7C3AED'
              ]
        }
        style={styles.header}
      >

        <TouchableOpacity
          onPress={() =>
            router.back()
          }
          style={styles.backBtn}
        >
          <Text
            style={styles.backText}
          >
            ← Back
          </Text>
        </TouchableOpacity>

        <Text
          style={styles.headerTitle}
          numberOfLines={1}
        >
          {title}
        </Text>

        <View
          style={styles.statsRow}
        >

          <View
            style={styles.statBox}
          >
            <Text
              style={styles.statNum}
            >
              {deliveredCount}
            </Text>

            <Text
              style={styles.statLabel}
            >
              Delivered
            </Text>
          </View>

          <View
            style={styles.statBox}
          >
            <Text
              style={styles.statNum}
            >
              {readCount}
            </Text>

            <Text
              style={styles.statLabel}
            >
              Read
            </Text>
          </View>

          <View
            style={styles.statBox}
          >
            <Text
              style={styles.statNum}
            >
              {deliveredCount > 0
                ? Math.round(
                    (
                      readCount /
                      deliveredCount
                    ) * 100
                  )
                : 0}
              %
            </Text>

            <Text
              style={styles.statLabel}
            >
              Read Rate
            </Text>
          </View>

        </View>

      </LinearGradient>

      {loading ? (

        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{
            marginTop: 40
          }}
        />

      ) : (

        <FlatList
          data={receipts}
          keyExtractor={(item) =>
            item.user_id ||
            item.email
          }
          renderItem={renderItem}
          contentContainerStyle={{
            padding: 16
          }}
          ListEmptyComponent={
            <Text
              style={[
                styles.empty,
                {
                  color:
                    colors.textLight
                }
              ]}
            >
              No delivery data yet
            </Text>
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
    color:
      'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '600'
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16
  },

  statsRow: {
    flexDirection: 'row',
    backgroundColor:
      'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16
  },

  statBox: {
    flex: 1,
    alignItems: 'center'
  },

  statNum: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff'
  },

  statLabel: {
    fontSize: 11,
    color:
      'rgba(255,255,255,0.7)',
    marginTop: 2
  },

  card: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
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
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2
  },

  email: {
    fontSize: 12,
    marginBottom: 4
  },

  readTime: {
    fontSize: 11,
    fontWeight: '600'
  },

  empty: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15
  }

});