import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const TabIcon = ({ emoji, focused }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
);

export default function MemberLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: 'Members',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
        }}
      />
      <Tabs.Screen name="inbox" options={{ href: null }} />
      <Tabs.Screen name="private-chat" options={{ href: null }} />
      <Tabs.Screen name="group-chat" options={{ href: null }} />
      <Tabs.Screen name="groups" options={{ href: null }} />
      <Tabs.Screen name="message" options={{ href: null }} />
    </Tabs>
  );
}