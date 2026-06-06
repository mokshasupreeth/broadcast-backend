import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from 'react-native';
import api from '../../services/api';

export default function PhoneOTP() {
  const { phone, name, username, email, password } = useLocalSearchParams();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [timer, setTimer] = useState(60);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    sendOTP();
  }, []);

  useEffect(() => {
    if (timer > 0 && sent) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer, sent]);

  const sendOTP = async () => {
    setSending(true);
    try {
      await api.post('/api/forgot/send-sms-otp', { phone });
      setSent(true);
      setTimer(60);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setSending(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Enter 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      // Verify SMS OTP
      await api.post('/api/forgot/verify-sms-otp', { phone, otp });
      // Register user
      await api.post('/api/auth/register', {
        name, username, email, password, phone
      });
      Alert.alert('✅ Success!', 'Account created! Waiting for admin approval.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') }
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#09010F', '#0E0520', '#130A28']}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>📱</Text>
        <Text style={styles.title}>Verify Phone</Text>
        <Text style={styles.subtitle}>
          OTP sent to{'\n'}{phone}
        </Text>

        {sending ? (
          <ActivityIndicator color="#7C3AED" style={{ marginVertical: 20 }} />
        ) : (
          <>
            <TextInput
              style={styles.otpInput}
              placeholder="000000"
              placeholderTextColor="rgba(167,139,250,0.45)"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
            />

            <TouchableOpacity
              style={styles.btn}
              onPress={verifyOTP}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Verify & Register →</Text>
              }
            </TouchableOpacity>

            {timer > 0 ? (
              <Text style={styles.timerText}>Resend OTP in {timer}s</Text>
            ) : (
              <TouchableOpacity onPress={() => { setTimer(60); sendOTP(); }}>
                <Text style={styles.resendText}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: 'rgba(20,8,45,0.85)',
    borderRadius: 28, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)',
  },
  logo: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#F5F0FF', marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'rgba(167,139,250,0.6)', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  otpInput: {
    width: '100%', backgroundColor: 'rgba(167,139,250,0.07)',
    borderRadius: 14, padding: 18, fontSize: 28,
    fontWeight: '800', color: '#A78BFA',
    borderWidth: 2, borderColor: 'rgba(167,139,250,0.3)',
    letterSpacing: 8, marginBottom: 16,
  },
  btn: {
    width: '100%', backgroundColor: '#7C3AED',
    borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  timerText: { fontSize: 13, color: 'rgba(167,139,250,0.6)' },
  resendText: { fontSize: 13, color: '#A78BFA', fontWeight: '700' },
  backText: { fontSize: 14, color: '#A78BFA', fontWeight: '600' },
});