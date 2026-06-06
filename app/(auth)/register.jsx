import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function Register() {
  const [name,     setName]     = useState('');
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [phone,    setPhone]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password || !username || !phone) {
      Alert.alert('Error', 'All fields including phone are required');
      return;
    }
    if (phone.length < 10) {
      Alert.alert('Error', 'Enter valid phone number with country code (e.g. +91XXXXXXXXXX)');
      return;
    }
    // Go to phone OTP verification first
    router.push({
      pathname: '/(auth)/phone-otp',
      params: { phone, name, username, email, password },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={['#09010F', '#0E0520', '#130A28']} style={styles.bg} />

      {/* Aurora orb */}
      <View style={styles.orb} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Card */}
        <View style={styles.card}>

          {/* Header */}
          <View style={styles.logoWrap}>
            <LinearGradient colors={['#A78BFA', '#7C3AED']} style={styles.logoGrad}>
              <Text style={styles.logoEmoji}>📡</Text>
            </LinearGradient>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Broadcast</Text>

          {/* Fields */}
          <Field
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            icon="👤"
          />
          <Field
            placeholder="Username (min 3 chars)"
            value={username}
            onChangeText={setUsername}
            icon="@"
            autoCapitalize="none"
          />
          <Field
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            icon="✉️"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field
            placeholder="Password (min 6 chars)"
            value={password}
            onChangeText={setPassword}
            icon="🔒"
            secureTextEntry
          />
          <Field
            placeholder="Phone with country code (e.g. +91XXXXXXXXXX)"
            value={phone}
            onChangeText={setPhone}
            icon="📱"
            keyboardType="phone-pad"
          />

          {/* Button */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
            style={styles.btnWrap}
          >
            <LinearGradient colors={['#A78BFA', '#7C3AED']} style={styles.btn}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Continue →</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.link}>
              Already have an account?{' '}
              <Text style={styles.linkBold}>Login</Text>
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Reusable field ────────────────────────────────────────────────────────────
function Field({ icon, ...props }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldIcon}>{icon}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="rgba(167,139,250,0.45)"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bg:  { ...StyleSheet.absoluteFillObject },
  orb: {
    position: 'absolute', top: -60, right: -60,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(124,58,237,0.18)',
  },

  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 48,
  },

  card: {
    backgroundColor: 'rgba(20,8,45,0.75)',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
  },

  logoWrap: { marginBottom: 16 },
  logoGrad: {
    width: 72, height: 72, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  logoEmoji: { fontSize: 36 },

  title: {
    fontSize: 26, fontWeight: '800',
    color: '#F5F0FF', marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  subtitle: {
    fontSize: 13, color: 'rgba(167,139,250,0.6)',
    marginBottom: 28, letterSpacing: 1,
    textTransform: 'uppercase',
  },

  fieldWrap: {
    width: '100%', flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(167,139,250,0.07)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
    paddingHorizontal: 14, marginBottom: 12,
  },
  fieldIcon: { fontSize: 16, marginRight: 10, opacity: 0.7 },
  input: {
    flex: 1, paddingVertical: 14,
    fontSize: 15, color: '#EDE9FE',
  },

  btnWrap: { width: '100%', marginTop: 8, marginBottom: 16 },
  btn: {
    borderRadius: 14, padding: 16,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },

  link:     { fontSize: 13, color: 'rgba(167,139,250,0.55)' },
  linkBold: { color: '#A78BFA', fontWeight: '700' },
});