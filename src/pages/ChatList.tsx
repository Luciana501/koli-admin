import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeToChatMessages, ChatMessage } from "@/services/chat";
import { auth } from "@/lib/firebase";
import { IconMessage } from "@tabler/icons-react";

const ChatList = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = subscribeToChatMessages((data) => {
      setMessages(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Group messages by sender
  const getConversations = () => {
    const currentUserId = auth.currentUser?.uid;
    const conversations = new Map<string, ChatMessage[]>();

    messages.forEach((msg) => {
      if (msg.senderId !== currentUserId) {
        if (!conversations.has(msg.senderId)) {
          conversations.set(msg.senderId, []);
        }
        conversations.get(msg.senderId)!.push(msg);
      }
    });

    // Convert to array and sort by latest message
    return Array.from(conversations.entries()).map(([senderId, msgs]) => {
      const latestMessage = msgs[msgs.length - 1];
      const unreadCount = msgs.filter((m) => !m.read).length;
      return {
        senderId,
        senderName: latestMessage.senderName,
        senderType: latestMessage.senderType,
        latestMessage: latestMessage.message,
        timestamp: latestMessage.timestamp,
        unreadCount,
        messages: msgs,
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const conversations = getConversations();

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
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading messages...</div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <IconMessage className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No messages yet</h2>
        <p className="text-muted-foreground">
          Start a conversation with other admins
        </p>
      </div>
    );
  }

  return (
    <div className="h-full bg-background">
      <div className="border-b p-4">
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-sm text-muted-foreground">
          {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="divide-y">
        {conversations.map((conversation) => (
          <div
            key={conversation.senderId}
            onClick={() => navigate("/chat/conversation")}
            className="p-4 hover:bg-accent cursor-pointer transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-semibold text-primary">
                  {conversation.senderName.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold truncate">
                    {conversation.senderName}
                  </h3>
                  <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                    {formatTime(conversation.timestamp)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground truncate">
                    {conversation.latestMessage}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <span className="flex-shrink-0 ml-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {conversation.unreadCount}
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
