import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { subscribeToChatMessages, sendChatMessage, markMessagesAsRead, uploadChatFiles, ChatMessage } from "@/services/chat";
import { auth } from "@/lib/firebase";
import { IconSend, IconArrowLeft, IconPaperclip, IconX, IconFile, IconDownload, IconCornerDownRight } from "@tabler/icons-react";

const Chat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [imageModal, setImageModal] = useState<{ url: string; name: string } | null>(null);
  const { adminType } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = auth.currentUser;
    
    // Subscribe to real-time chat messages (WebSocket-like)
    const unsubscribe = subscribeToChatMessages((data) => {
      console.log("Received messages:", data);
      setMessages(data);
      setLoading(false);
    });

    // Mark messages as read after a short delay to ensure subscription is active
    if (currentUser) {
      setTimeout(() => {
        markMessagesAsRead(currentUser.uid);
      }, 500);
    }

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
      window.open(url, '_blank');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() && selectedFiles.length === 0) {
      console.log("Empty message and no files, not sending");
      return;
    }
    
    if (!auth.currentUser) {
      console.error("No authenticated user");
      alert("You must be logged in to send messages");
      return;
    }

    console.log("Sending message:", newMessage);
    console.log("Current user:", auth.currentUser.uid);
    console.log("Admin type:", adminType);
    setSending(true);

    try {
      let attachments = [];
      
      // Upload files if any
      if (selectedFiles.length > 0) {
        console.log("Uploading files...");
        attachments = await uploadChatFiles(selectedFiles);
        console.log("Files uploaded:", attachments);
      }

      const success = await sendChatMessage(
        auth.currentUser.uid,
        adminType === "developer" ? "Developer Admin" : "Finance Admin",
        adminType || "developer",
        newMessage.trim() || "(File attachment)",
        attachments,
        replyingTo ? {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          message: replyingTo.message
        } : undefined
      );

      setSending(false);

      if (success) {
        console.log("Message sent successfully");
        setNewMessage("");
        setSelectedFiles([]);
        setReplyingTo(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        console.error("Failed to send message");
        alert("Failed to send message. Check console for details or verify Firestore permissions.");
      }
    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      setSending(false);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes < 1 ? "Just now" : `${minutes} min ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const parseSharedUserFromMessage = (message: string) => {
    const lines = message.split("\n");
    const getValue = (prefix: string) => {
      const match = lines.find((line) => line.startsWith(prefix));
      return match ? match.replace(prefix, "").trim() : "";
    };

    return {
      name: getValue("Name:"),
      email: getValue("Email:"),
      phone: getValue("Phone:"),
      address: getValue("Address:"),
      donation: getValue("Donation:"),
      totalAsset: getValue("Total Asset:"),
      kyc: getValue("KYC:"),
      note: getValue("Validation Note:"),
    };
  };

  if (loading) {
    return (
      <div className="p-2 sm:p-4">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100svh-5.5rem)] md:h-[calc(100svh-6.5rem)]">
      <div className="mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => navigate("/chat")}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
        >
          <IconArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Admin Chat</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Real-time communication between admins
          </p>
        </div>
      </div>

      <div className="flex-1 bg-card border border-border rounded-lg flex flex-col overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwnMessage = msg.senderType === adminType;
              const parsedShare = msg.shareMeta?.type === "user_profile_share"
                ? parseSharedUserFromMessage(msg.message)
                : null;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"}`}
                >
                  {/* Header */}
                  <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? "flex-row-reverse" : ""}`}>
                    <span className="text-sm font-medium">{msg.senderName}</span>
                    <time className="text-xs text-muted-foreground">
                      {formatTime(msg.timestamp)}
                    </time>
                  </div>
                  
                  {/* Message bubble with reply button */}
                  <div className={`flex items-start gap-2 group ${isOwnMessage ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`min-w-[100px] max-w-[85%] sm:max-w-[70%] rounded-2xl ${
                        isOwnMessage
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}
                    >
                      {/* Reply context */}
                      {msg.replyTo && (
                        <div className="px-4 pt-2">
                          <div className="border-l-2 border-current opacity-60 pl-2 py-1 text-xs">
                            <p className="font-medium">{msg.replyTo.senderName}</p>
                            <p className="truncate">{msg.replyTo.message}</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="px-4 py-2">
                        {msg.shareMeta?.type === "user_profile_share" ? (
                          <div
                            className={`rounded-lg border p-3 space-y-2 text-sm ${
                              isOwnMessage
                                ? "border-primary-foreground/30 bg-primary-foreground/10"
                                : "border-border bg-background/70"
                            }`}
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                              Shared User Profile for {msg.shareMeta.toAdminType} admin
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              <p className="break-words">
                                <span className="font-medium">Name:</span>{" "}
                                {`${msg.shareMeta.userSnapshot?.firstName || ""} ${msg.shareMeta.userSnapshot?.lastName || ""}`.trim() || parsedShare?.name || "N/A"}
                              </p>
                              <p className="break-words">
                                <span className="font-medium">Email:</span> {msg.shareMeta.userEmail || parsedShare?.email || "N/A"}
                              </p>
                              <p className="break-words">
                                <span className="font-medium">Phone:</span>{" "}
                                {msg.shareMeta.userSnapshot?.phoneNumber || parsedShare?.phone || "N/A"}
                              </p>
                              <p className="break-words">
                                <span className="font-medium">KYC:</span>{" "}
                                {msg.shareMeta.userSnapshot?.kycStatus || parsedShare?.kyc || "NOT_SUBMITTED"}
                              </p>
                              <p className="break-words sm:col-span-2">
                                <span className="font-medium">Address:</span>{" "}
                                {msg.shareMeta.userSnapshot?.address || parsedShare?.address || "N/A"}
                              </p>
                              <p>
                                <span className="font-medium">Donation:</span>{" "}
                                {msg.shareMeta.userSnapshot?.donationAmount != null
                                  ? `₱${(msg.shareMeta.userSnapshot.donationAmount || 0).toLocaleString()}`
                                  : parsedShare?.donation || "₱0"}
                              </p>
                              <p>
                                <span className="font-medium">Total Asset:</span>{" "}
                                {msg.shareMeta.userSnapshot?.totalAsset != null
                                  ? `₱${(msg.shareMeta.userSnapshot.totalAsset || 0).toLocaleString()}`
                                  : parsedShare?.totalAsset || "₱0"}
                              </p>
                            </div>
                            {(msg.shareMeta.note || parsedShare?.note) && (
                              <div className="pt-2 border-t border-current/20">
                                <p className="text-xs font-medium opacity-80">Validation Note</p>
                                <p className="break-words">{msg.shareMeta.note || parsedShare?.note}</p>
                              </div>
                            )}
                            <div className="pt-2">
                              <button
                                onClick={() => navigate(`/users?openUserId=${msg.shareMeta?.userId || ""}`)}
                                className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                  isOwnMessage
                                    ? "bg-primary-foreground/20 hover:bg-primary-foreground/30"
                                    : "bg-muted hover:bg-muted/80"
                                }`}
                              >
                                Open User
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                        )}
                      </div>
                    
                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="px-4 pb-2 space-y-2">
                        {msg.attachments.map((attachment, index) => {
                          console.log('Rendering attachment:', attachment);
                          const isImage = attachment.type?.startsWith('image/');
                          
                          if (isImage) {
                            return (
                              <div key={index} className="space-y-1">
                                <div
                                  className="block cursor-pointer"
                                  onClick={() => setImageModal({ url: attachment.url, name: attachment.name })}
                                >
                                  <img
                                    src={attachment.url}
                                    alt={attachment.name}
                                    className="max-w-full max-h-[300px] rounded-md object-contain hover:opacity-90 transition-opacity"
                                    onError={(e) => {
                                      console.error('Image load error:', e);
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-xs opacity-70">
                                  <span className="truncate">{attachment.name}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload(attachment.url, attachment.name);
                                    }}
                                    className="ml-2 flex items-center gap-1 hover:underline"
                                  >
                                    <IconDownload className="h-3 w-3" />
                                    Download
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          
                          return (
                            <button
                              key={index}
                              onClick={() => handleDownload(attachment.url, attachment.name)}
                              className={`w-full flex items-center gap-2 p-2 rounded-md transition-colors ${
                                isOwnMessage
                                  ? "bg-primary-foreground/10 hover:bg-primary-foreground/20"
                                  : "bg-muted-foreground/10 hover:bg-muted-foreground/20"
                              }`}
                            >
                              <IconFile className="h-4 w-4 flex-shrink-0" />
                              <div className="flex-1 min-w-0 text-left">
                                <p className="text-xs font-medium truncate">{attachment.name}</p>
                                <p className="text-xs opacity-70">{formatFileSize(attachment.size)}</p>
                              </div>
                              <IconDownload className="h-4 w-4 flex-shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Reply button outside bubble */}
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="p-1.5 hover:bg-accent rounded-full transition-colors opacity-0 group-hover:opacity-60 hover:!opacity-100 flex-shrink-0 mt-auto mb-1"
                    title="Reply"
                  >
                    <IconCornerDownRight className="h-4 w-4" />
                  </button>
                </div>
                  
                  {/* Footer */}
                  <div className="mt-1">
                    <span className="text-xs text-muted-foreground">
                      {msg.read ? "Seen" : "Delivered"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border p-3 sm:p-4">
          {/* Replying to indicator */}
          {replyingTo && (
            <div className="mb-3 flex items-center justify-between px-3 py-2 bg-muted rounded-md text-sm">
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">Replying to {replyingTo.senderName}</p>
                <p className="text-sm truncate">{replyingTo.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-1 hover:bg-background rounded"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
          )}
          
          {/* Selected files preview */}
          {selectedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm"
                >
                  <IconFile className="h-4 w-4" />
                  <span className="max-w-[150px] truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="ml-1 p-0.5 hover:bg-background rounded"
                  >
                    <IconX className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <form onSubmit={handleSendMessage} className="flex gap-1.5 sm:gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="p-2.5 rounded-md border border-input bg-background hover:bg-accent transition-colors disabled:opacity-50"
              title="Attach files"
            >
              <IconPaperclip className="h-5 w-5" />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={sending}
              className="flex-1 px-4 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending}
              className="px-3 sm:px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <IconSend className="h-4 w-4" />
              <span className="hidden sm:inline">{sending ? "Sending..." : "Send"}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Image Modal */}
      {imageModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setImageModal(null)}
        >
          <div 
            className="relative max-w-[90vw] max-h-[90vh] bg-card rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold truncate pr-4">{imageModal.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(imageModal.url, imageModal.name)}
                  className="p-2 hover:bg-accent rounded-md transition-colors"
                  title="Download"
                >
                  <IconDownload className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setImageModal(null)}
                  className="p-2 hover:bg-accent rounded-md transition-colors"
                  title="Close"
                >
                  <IconX className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Modal Image */}
            <div className="flex items-center justify-center p-4 bg-black/50">
              <img
                src={imageModal.url}
                alt={imageModal.name}
                className="max-w-full max-h-[calc(90vh-100px)] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
