import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator, Alert, StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from 'react-native';
import Colors from '../../constants/colors';
import api from '../../lib/api';

export default function ResetPassword() {
  const { email, otp } = useLocalSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!newPassword || !confirm) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (newPassword !== confirm) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/forgot/reset-password', { email, otp, newPassword });
      Alert.alert('Success!', 'Password reset successfully. Please login.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') }
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>🔑</Text>
        <Text style={styles.title}>New Password</Text>
        <Text style={styles.subtitle}>Set a new password for your account</Text>

        <TextInput
          style={styles.input}
          placeholder="New Password"
          placeholderTextColor={Colors.gray}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor={Colors.gray}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btn} onPress={handleReset} disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.btnText}>Reset Password</Text>
          }
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
});