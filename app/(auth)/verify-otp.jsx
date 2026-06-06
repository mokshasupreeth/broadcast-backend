import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator, Alert, StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from 'react-native';
import Colors from '../../constants/colors';
import api from '../../lib/api';

export default function VerifyOTP() {
  const { email } = useLocalSearchParams();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Error', 'Enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/forgot/verify-otp', { email, otp });
      router.push({ pathname: '/(auth)/reset-password', params: { email, otp } });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await api.post('/api/forgot/send-otp', { email });
      Alert.alert('Sent!', 'New OTP sent to your email');
    } catch (err) {
      Alert.alert('Error', 'Failed to resend OTP');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>📨</Text>
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>We sent a 6-digit OTP to{'\n'}{email}</Text>

        <TextInput
          style={styles.otpInput}
          placeholder="000000"
          placeholderTextColor={Colors.gray}
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
        />

        <TouchableOpacity style={styles.btn} onPress={handleVerify} disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.btnText}>Verify OTP</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend}>
          <Text style={styles.link}>Didn't get it? <Text style={styles.linkBold}>Resend OTP</Text></Text>
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
  otpInput: { width: '100%', backgroundColor: Colors.background, borderRadius: 10, padding: 16, marginBottom: 14, fontSize: 28, fontWeight: '700', color: Colors.primary, borderWidth: 2, borderColor: Colors.primary, letterSpacing: 8 },
  btn: { width: '100%', backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  link: { fontSize: 13, color: Colors.textLight },
  linkBold: { color: Colors.primary, fontWeight: '700' },
});