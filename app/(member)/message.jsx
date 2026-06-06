import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function MessageDetail() {
  const { colors, isDark } = useTheme();
  const { title, body, date } = useLocalSearchParams();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#1E3A8A', '#1E293B'] : ['#1D4ED8', '#7C3AED']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.headerDate}>
          {date ? new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
        </Text>
      </LinearGradient>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.body, { color: colors.text }]}>{body}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 },
  backBtn: { marginBottom: 16 },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  headerDate: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10 },
  body: { fontSize: 16, lineHeight: 26 },
});