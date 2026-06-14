import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, PieceColor } from "../types";
import { MessageSquare, Send, ShieldAlert } from "lucide-react";

interface ChatBoxProps {
  chatLog: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUser: string;
  userRole: PieceColor | "spectator";
}

export const ChatBox: React.FC<ChatBoxProps> = ({
  chatLog,
  onSendMessage,
  currentUser,
  userRole,
}) => {
  const [msgText, setMsgText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    onSendMessage(msgText.trim());
    setMsgText("");
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatLog]);

  const getRoleBadgeClasses = (role?: string) => {
    if (role === "w") {
      return "bg-pink-100 text-pink-700 border border-pink-200 font-bold text-[8px]";
    }
    if (role === "b") {
      return "bg-slate-800 text-white border border-slate-900 font-bold text-[8px]";
    }
    return "bg-indigo-50 text-indigo-600 border border-indigo-200 text-[8px]";
  };

  const getRoleLabel = (role?: string) => {
    if (role === "w") return "WHITE";
    if (role === "b") return "BLACK";
    return "SPECTATOR";
  };

  return (
    <div id="chatbox_container" className="bg-white border border-pink-100 rounded-xl p-4 flex flex-col h-64 shadow-[0_2px_15px_-3px_rgba(244,143,177,0.1)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-pink-100 pb-2 mb-2 select-none">
        <MessageSquare className="w-4 h-4 text-pink-500" />
        <h3 className="text-sm font-bold tracking-wide uppercase text-pink-700 font-sans">
          Room Live Chat
        </h3>
        <span className="text-[9px] ml-auto font-mono text-pink-500 flex items-center gap-1">
          As:{" "}
          <span className={`px-1 rounded ${getRoleBadgeClasses(userRole)}`}>
            {getRoleLabel(userRole)}
          </span>
        </span>
      </div>

      {/* Messages */}
      <div
        id="chat_messages_flow"
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2.5 mb-2 pr-1 scrollbar-thin scrollbar-thumb-pink-200"
      >
        {chatLog.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 italic py-6 select-none font-sans text-xs">
            <span>Room chat is quiet.</span>
            <span className="text-[10px] text-pink-400 font-semibold">Send a greeting first!</span>
          </div>
        ) : (
          chatLog.map((chat) => (
            <div
              id={`chat_msg_${chat.id}`}
              key={chat.id}
              className={`flex flex-col p-2 rounded-lg border text-xs leading-relaxed ${
                chat.sender === currentUser
                  ? "bg-pink-50/40 border-pink-200"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-sans text-[10px] font-bold text-slate-800">
                  {chat.sender}
                </span>
                <span
                  className={`text-[7px] font-mono px-1 rounded-sm ${getRoleBadgeClasses(
                    chat.senderColor
                  )}`}
                >
                  {getRoleLabel(chat.senderColor)}
                </span>
                <span className="text-[8px] text-slate-400 font-mono ml-auto">
                  {chat.timestamp}
                </span>
              </div>
              <p className="text-slate-700 break-words font-sans">{chat.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          id="chat_input_field"
          type="text"
          value={msgText}
          onChange={(e) => setMsgText(e.target.value)}
          placeholder="Send message..."
          maxLength={120}
          className="flex-1 bg-white text-slate-800 text-xs px-3 py-2 rounded-lg border border-pink-200 focus:outline-none focus:border-pink-500 transition-colors placeholder-pink-300 font-sans"
        />
        <button
          id="send_chat_button"
          type="submit"
          className="bg-pink-500 hover:bg-pink-600 text-white p-2 rounded-lg transition-colors flex items-center justify-center border border-pink-400/30 shadow-sm cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
