import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { PresenceProvider } from './context/PresenceContext.jsx';
import { ChatProvider } from './context/ChatContext.jsx';
import { CallProvider } from './context/CallContext.jsx';
import CallOverlay from './components/CallOverlay.jsx';
import RegisterScreen from './screens/RegisterScreen.jsx';
import ChatListScreen from './screens/ChatListScreen.jsx';
import NewChatScreen from './screens/NewChatScreen.jsx';
import ChatScreen from './screens/ChatScreen.jsx';
import GroupChatScreen from './screens/GroupChatScreen.jsx';
import CreateGroupScreen from './screens/CreateGroupScreen.jsx';
import ProfileScreen from './screens/ProfileScreen.jsx';
import SearchScreen from './screens/SearchScreen.jsx';

function Routed() {
  const { user, loading } = useAuth();
  // route: { name: 'chats' | 'profile' | 'newChat' | 'chat', peer? }
  const [route, setRoute] = useState({ name: 'chats' });

  // Kullanici degisince (cikis/yeni kayit) sohbet listesine don
  useEffect(() => {
    setRoute({ name: 'chats' });
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 dark:bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
      </div>
    );
  }

  if (!user) return <RegisterScreen />;

  const toChats = () => setRoute({ name: 'chats' });
  // Sohbet listesinden veya aramadan acma: DM ya da grup
  const openChat = (item) =>
    item.kind === 'group'
      ? setRoute({ name: 'group', group: item.group })
      : setRoute({ name: 'chat', peer: item.partner || item });

  switch (route.name) {
    case 'profile':
      return <ProfileScreen onBack={toChats} />;
    case 'newChat':
      return (
        <NewChatScreen
          onBack={toChats}
          onPick={(peer) => setRoute({ name: 'chat', peer })}
          onNewGroup={() => setRoute({ name: 'createGroup' })}
        />
      );
    case 'createGroup':
      return (
        <CreateGroupScreen
          onBack={() => setRoute({ name: 'newChat' })}
          onCreated={(group) => setRoute({ name: 'group', group })}
        />
      );
    case 'chat':
      return <ChatScreen peer={route.peer} onBack={toChats} />;
    case 'group':
      return <GroupChatScreen group={route.group} onBack={toChats} />;
    case 'search':
      return <SearchScreen onBack={toChats} onOpenChat={openChat} />;
    default:
      return (
        <ChatListScreen
          onOpenChat={openChat}
          onNewChat={() => setRoute({ name: 'newChat' })}
          onEditProfile={() => setRoute({ name: 'profile' })}
          onSearch={() => setRoute({ name: 'search' })}
        />
      );
  }
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <PresenceProvider>
          <ChatProvider>
            <CallProvider>
              <Routed />
              <CallOverlay />
            </CallProvider>
          </ChatProvider>
        </PresenceProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
