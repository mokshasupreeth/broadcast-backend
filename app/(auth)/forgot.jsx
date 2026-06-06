import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator, Alert, StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from 'react-native';
import Colors from '../../constants/colors';
import api from '../../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email) {
      Alert.alert('Error', 'Enter your email');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/forgot/send-otp', { email });
      router.push({ pathname: '/(auth)/verify-otp', params: { email } });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>🔐</Text>
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>Enter your email to receive an OTP</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.gray}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TouchableOpacity style={styles.btn} onPress={handleSend} disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.btnText}>Send OTP</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>← Back to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: Colors.white, borderRadius: 20, padding: 28, alignItems: 'center' },
  logo: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.textLight, marginBottom: 28, textAlign: 'center' },
  input: { width: '100%', backgroundColor: Colors.background, borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.lightGray },
  btn: { width: '100%', backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  link: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});