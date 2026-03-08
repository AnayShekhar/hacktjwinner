import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette } from '@/constants/design';
import { getIsLoggedIn } from '@/stores/authStore';

export default function TabLayout() {
  if (!getIsLoggedIn()) {
    return <Redirect href="/welcome" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#BBD5C6',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <IconSymbol size={20} name="house.fill" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <IconSymbol size={20} name="clock.fill" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarButton: (props) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Scan"
              onPress={props.onPress}
              style={styles.scanTabButton}
              activeOpacity={0.9}
            >
              <View style={styles.scanButtonInner}>
                <IconSymbol size={24} name="camera.fill" color="#FFFFFF" />
              </View>
              <Text style={styles.scanLabel}>Scan</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: 'About',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <IconSymbol size={20} name="info.circle.fill" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <IconSymbol size={20} name="gearshape.fill" color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Palette.primary,
    borderTopWidth: 0,
    height: 86,
    position: 'absolute',
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 26,
    paddingTop: 10,
    paddingBottom: 12,
  },
  tabItem: {
    borderRadius: 16,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: Palette.primarySoft,
  },
  scanTabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
  },
  scanButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 3,
    borderColor: Palette.primary,
  },
  scanLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#D7F0E3',
  },
});
