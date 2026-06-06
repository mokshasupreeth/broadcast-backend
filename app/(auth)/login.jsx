import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions,
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { login } from '../../services/api';
import { saveAuth } from '../../store/authStore';

const { width, height } = Dimensions.get('window');

export default function Login() {
  const { isDark, toggle } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await login({ email, password });
      const { token, user } = res.data;
      await saveAuth(token, user);
      setTimeout(() => {
        if (user.role === 'admin') router.push('/(admin)/dashboard');
        else router.push('/(member)/chats');
      }, 300);
    } catch (err) {
      Alert.alert('Login Failed', err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={isDark ? ['#0F0C29', '#302B63', '#24243e'] : ['#667eea', '#764ba2']}
        style={styles.bg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative blobs */}
      <View style={[styles.blob1, { backgroundColor: isDark ? 'rgba(118,75,162,0.3)' : 'rgba(255,255,255,0.15)' }]} />
      <View style={[styles.blob2, { backgroundColor: isDark ? 'rgba(102,126,234,0.2)' : 'rgba(255,255,255,0.1)' }]} />

      {/* Theme toggle */}
      <TouchableOpacity style={styles.themeBtn} onPress={toggle}>
        <Text style={styles.themeIcon}>{isDark ? '☀️' : '🌙'}</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo section */}
        <View style={styles.logoSection}>
          <View style={styles.logoRing}>
            <View style={styles.logoInner}>
              <Text style={styles.logoEmoji}>📡</Text>
            </View>
          </View>
          <Text style={styles.appName}>Broadcast</Text>
          <Text style={styles.tagline}>Connect. Communicate. Collaborate.</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.95)' }]}>
          <Text style={[styles.cardTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}>Welcome back 👋</Text>
          <Text style={[styles.cardSub, { color: isDark ? 'rgba(255,255,255,0.5)' : '#666' }]}>Sign in to your account</Text>

          {/* Email */}
          <View style={[
            styles.inputBox,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f5f5f5', borderColor: focused === 'email' ? '#667eea' : 'transparent' }
          ]}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={[styles.input, { color: isDark ? '#fff' : '#1a1a2e' }]}
              placeholder="Email address"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#aaa'}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
            />
          </View>

          {/* Password */}
          <View style={[
            styles.inputBox,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f5f5f5', borderColor: focused === 'password' ? '#667eea' : 'transparent' }
          ]}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={[styles.input, { color: isDark ? '#fff' : '#1a1a2e' }]}
              placeholder="Password"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#aaa'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)}>
              <Text style={styles.inputIcon}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Forgot */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot')}
            style={styles.forgotRow}
          >
            <Text style={[styles.forgotText, { color: '#667eea' }]}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={styles.loginBtnWrap}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.loginBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.loginBtnText}>Sign In →</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.divLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#eee' }]} />
            <Text style={[styles.divText, { color: isDark ? 'rgba(255,255,255,0.3)' : '#ccc' }]}>or</Text>
            <View style={[styles.divLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#eee' }]} />
          </View>

          {/* Register */}
          <TouchableOpacity
            style={[styles.registerBtn, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#667eea' }]}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={[styles.registerBtnText, { color: isDark ? 'rgba(255,255,255,0.7)' : '#667eea' }]}>
              Create new account
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Broadcast v3.0 • Secure & Private</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg: { ...StyleSheet.absoluteFillObject },
  blob1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, top: -100, right: -80 },
  blob2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, bottom: 100, left: -60 },
  themeBtn: { position: 'absolute', top: 56, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 20 },
  themeIcon: { fontSize: 18 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 80 },
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoInner: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  logoEmoji: { fontSize: 36 },
  appName: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6, letterSpacing: 0.5 },
  card: { borderRadius: 28, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)' },
  cardTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  cardSub: { fontSize: 14, marginBottom: 24 },
  inputBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, marginBottom: 14, borderWidth: 1.5 },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15 },
  forgotRow: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { fontSize: 13, fontWeight: '600' },
  loginBtnWrap: { borderRadius: 14, overflow: 'hidden', marginBottom: 20 },
  loginBtn: { paddingVertical: 16, alignItems: 'center' },
  loginBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  divLine: { flex: 1, height: 1 },
  divText: { marginHorizontal: 12, fontSize: 12 },
  registerBtn: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  registerBtnText: { fontWeight: '700', fontSize: 15 },
  version: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 24 },
});