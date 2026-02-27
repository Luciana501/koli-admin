import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeToChatMessages, ChatMessage } from "@/services/chat";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { IconMessage } from "@tabler/icons-react";
import PageLoading from "@/components/PageLoading";

interface Admin {
  id: string;
  email: string;
  type: "developer" | "finance";
}

const ChatList = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const { adminType } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = subscribeToChatMessages((data) => {
      setMessages(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const adminsRef = collection(db, "admins");
        const oppositeType = adminType === "developer" ? "finance" : "developer";
        const q = query(adminsRef, where("type", "==", oppositeType));
        const snapshot = await getDocs(q);
        
        const adminsList: Admin[] = snapshot.docs.map(doc => ({
          id: doc.id,
          email: doc.data().email,
          type: doc.data().type
        }));
        
        setAdmins(adminsList);
      } catch (error) {
        console.error("Error fetching admins:", error);
      }
    };

    if (adminType) {
      fetchAdmins();
    }
  }, [adminType]);

  // Group messages by sender and merge with all admins
  const getConversations = () => {
    const currentUserId = auth.currentUser?.uid;
    const conversations = new Map<string, any>();

    // First, add all opposite-type admins
    admins.forEach(admin => {
      conversations.set(admin.id, {
        senderId: admin.id,
        senderName: admin.email.split('@')[0], // Use email username as name
        senderType: admin.type,
        latestMessage: null,
        timestamp: null,
        unreadCount: 0,
        messages: [],
      });
    });

    // Then, overlay with actual messages
    messages.forEach((msg) => {
      if (msg.senderId !== currentUserId) {
        if (!conversations.has(msg.senderId)) {
          conversations.set(msg.senderId, {
            senderId: msg.senderId,
            senderName: msg.senderName,
            senderType: msg.senderType,
            latestMessage: null,
            timestamp: null,
            unreadCount: 0,
            messages: [],
          });
        }
        
        const conv = conversations.get(msg.senderId)!;
        conv.messages.push(msg);
        conv.latestMessage = msg.message;
        conv.timestamp = msg.timestamp;
        conv.senderName = msg.senderName; // Update with actual name from message
        if (!msg.read) {
          conv.unreadCount++;
        }
      }
    });

    // Convert to array and sort by latest message (conversations with messages first)
    return Array.from(conversations.values()).sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1; // Push empty conversations to the end
      if (!b.timestamp) return -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  };

  const conversations = getConversations();

  const getConversationPreview = (conversation: any) => {
    if (conversation.unreadCount > 1) {
      return `${conversation.unreadCount} new messages`;
    }

    if (conversation.unreadCount === 1) {
      return `${conversation.senderName} messaged you`;
    }

    return conversation.timestamp
      ? "Tap to open conversation"
      : "No messages yet - start a conversation";
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return <PageLoading className="min-h-[16rem]" />;
  }

  return (
    <div className="h-[calc(100svh-6rem)] bg-background flex flex-col overflow-hidden">
      <div className="border-b p-3 sm:p-4">
        <h1 className="text-xl sm:text-2xl font-bold">Messages</h1>
        <p className="text-sm text-muted-foreground">
          {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="divide-y flex-1 overflow-y-auto">
        {conversations.map((conversation) => (
          <div
            key={conversation.senderId}
            onClick={() => navigate("/chat/conversation")}
            className="p-3 sm:p-4 hover:bg-accent cursor-pointer transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-base sm:text-lg font-semibold text-primary">
                  {conversation.senderName.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold truncate">
                    {conversation.senderName}
                  </h3>
                  {conversation.timestamp && (
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {formatTime(conversation.timestamp)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground truncate">
                    {getConversationPreview(conversation)}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <span className="flex-shrink-0 ml-2 bg-primary text-primary-foreground text-xs font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                      {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                    </span>
                  )}
                </div>

                <div className="mt-1">
                  <span className="text-xs text-muted-foreground capitalize">
                    {conversation.senderType} Admin
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatList;
