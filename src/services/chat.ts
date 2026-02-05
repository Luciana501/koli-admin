import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, serverTimestamp, doc, updateDoc, getDocs, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

export interface ChatAttachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: "main" | "finance";
  message: string;
  timestamp: string;
  read: boolean;
  attachments?: ChatAttachment[];
  replyTo?: {
    id: string;
    senderName: string;
    message: string;
  };
}

// Mark messages as read for the current user
export const markMessagesAsRead = async (currentUserId: string): Promise<void> => {
  try {
    const messagesRef = collection(db, "chat");
    const q = query(messagesRef, where("read", "==", false));
    const snapshot = await getDocs(q);
    
    // Filter out current user's messages and update only messages from others
    const updatePromises = snapshot.docs
      .filter((document) => document.data().senderId !== currentUserId)
      .map((document) => {
        return updateDoc(doc(db, "chat", document.id), { read: true });
      });
    
    await Promise.all(updatePromises);
    console.log(`Marked ${updatePromises.length} messages as read`);
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
};

// Subscribe to real-time chat messages (WebSocket-like functionality)
export const subscribeToChatMessages = (callback: (messages: ChatMessage[]) => void) => {
  try {
    const messagesRef = collection(db, "chat");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log("Chat snapshot received, docs count:", snapshot.docs.length);
        const messages: ChatMessage[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            senderId: data.senderId || "",
            senderName: data.senderName || "",
            senderType: data.senderType || "main",
            message: data.message || "",
            timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
            read: data.read || false,
            attachments: data.attachments || [],
            replyTo: data.replyTo || undefined,
          };
        });
        callback(messages);
      },
      (error) => {
        console.error("Error listening to chat:", error);
        callback([]);
      }
    );
    
    return unsubscribe;
  } catch (error) {
    console.error("Error setting up chat listener:", error);
    return () => {};
  }
};

// Upload files to Firebase Storage
export const uploadChatFiles = async (files: File[]): Promise<ChatAttachment[]> => {
  try {
    const uploadPromises = files.map(async (file) => {
      const timestamp = Date.now();
      const storageRef = ref(storage, `chat-attachments/${timestamp}-${file.name}`);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      return {
        name: file.name,
        url,
        size: file.size,
        type: file.type,
      };
    });
    
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error("Error uploading files:", error);
    throw error;
  }
};

// Send a chat message to Firebase (saved and synced via WebSocket-like listeners)
export const sendChatMessage = async (
  senderId: string,
  senderName: string,
  senderType: "main" | "finance",
  message: string,
  attachments?: ChatAttachment[],
  replyTo?: { id: string; senderName: string; message: string }
): Promise<boolean> => {
  try {
    console.log("Attempting to send message to Firebase...");
    const messagesRef = collection(db, "chat");
    
    const docRef = await addDoc(messagesRef, {
      senderId,
      senderName,
      senderType,
      message,
      timestamp: serverTimestamp(),
      read: false,
      attachments: attachments || [],
      ...(replyTo && { replyTo }),
    });
    
    console.log("Message sent successfully with ID:", docRef.id);
    return true;
  } catch (error) {
    console.error("Error sending message to Firebase:", error);
    return false;
  }
};

