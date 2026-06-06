import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const TabIcon = ({ emoji, focused }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
);

export default function AdminLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray,
        tabBarStyle: {
          paddingBottom: 8,
          height: 60,
          backgroundColor: colors.card,
          borderTopColor: colors.border
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="compose"
        options={{
          title: 'Send',
          tabBarIcon: ({ focused }) => <TabIcon emoji="✉️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: 'Members',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen name="groups" options={{ href: null }} />
      <Tabs.Screen name="receipts" options={{ href: null }} />
      <Tabs.Screen name="requests" options={{ href: null }} />
      <Tabs.Screen name="private-chat" options={{ href: null }} />
    </Tabs>
  );
}