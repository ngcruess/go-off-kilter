import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserProvider, useUser } from './src/context/UserContext';
import { UserSetupScreen } from './src/screens/UserSetupScreen';
import { BrowseScreen } from './src/screens/BrowseScreen';
import { ProblemDetailScreen } from './src/screens/ProblemDetailScreen';
import { CreateScreen } from './src/screens/CreateScreen';
import { PublishScreen } from './src/screens/PublishScreen';
import { LogbookScreen } from './src/screens/LogbookScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

export type RootStackParamList = {
  Browse: undefined;
  ProblemDetail: { uuid: string };
  Create: { layoutId: number };
  Publish: { uuid: string; frames: string; layoutId: number };
  Profile: undefined;
  Logbook: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0a0a0a',
    card: '#1a1a1a',
    text: '#ffffff',
    border: '#333333',
    primary: '#42A5F5',
  },
};

function AppNavigator() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#42A5F5" />
      </View>
    );
  }

  if (!user) {
    return <UserSetupScreen />;
  }

  return (
    <NavigationContainer theme={theme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#1a1a1a' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { fontWeight: '600' },
          }}
        >
          <Stack.Screen
            name="Browse"
            component={BrowseScreen}
            options={{ title: 'Go Off Kilter', headerBackTitle: 'List' }}
          />
        <Stack.Screen
          name="ProblemDetail"
          component={ProblemDetailScreen}
          options={{ title: 'Problem' }}
        />
        <Stack.Screen
          name="Create"
          component={CreateScreen}
          options={{ title: 'Create Problem' }}
        />
        <Stack.Screen
          name="Publish"
          component={PublishScreen}
          options={{ title: 'Publish' }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Profile' }}
        />
        <Stack.Screen
          name="Logbook"
          component={LogbookScreen}
          options={{ title: 'Logbook' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <AppNavigator />
        <StatusBar style="light" />
      </UserProvider>
    </QueryClientProvider>
  );
}
