import { useColorScheme } from 'react-native';

export const lightColors = {
  primary: '#2563EB',
  background: '#F1F5F9',
  card: '#FFFFFF',
  text: '#1E293B',
  textLight: '#64748B',
  gray: '#94A3B8',
  lightGray: '#E2E8F0',
  danger: '#EF4444',
  success: '#22C55E',
  white: '#FFFFFF',
  border: '#E2E8F0',
  unread: '#EFF6FF',
  headerText: '#FFFFFF',
};

export const darkColors = {
  primary: '#3B82F6',
  background: '#0F172A',
  card: '#1E293B',
  text: '#F1F5F9',
  textLight: '#94A3B8',
  gray: '#64748B',
  lightGray: '#334155',
  danger: '#EF4444',
  success: '#22C55E',
  white: '#1E293B',
  border: '#334155',
  unread: '#1E3A5F',
  headerText: '#FFFFFF',
};

export const useTheme = () => {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
};