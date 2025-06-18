"use client";

import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Role = "user" | "ai";

interface Message {
  id: number;
  role: Role;
  content: string;
}

type GeminiRole = "user" | "model";

interface GeminiRequest {
  contents: {
    role: GeminiRole;
    parts: {
      text: string;
    }[];
  }[];
}

interface GeminiResponse {
  candidates?: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [parsedPdfText, setParsedPdfText] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const GEMINI_API_KEY = "Enter Api Key";
  const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
      }
    };
    document.body.appendChild(script);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") {
      alert("Please upload a valid PDF file.");
      return;
    }

    setUploadedFileName(file.name);

    const fileReader = new FileReader();
    fileReader.onload = async () => {
      const typedArray = new Uint8Array(fileReader.result as ArrayBuffer);
      const pdf = await window.pdfjsLib.getDocument(typedArray).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map((item: any) => item.str).join(" ");
        fullText += `Page ${i}: ${text}\n`;
      }

      setParsedPdfText(fullText);
    };

    fileReader.readAsArrayBuffer(file);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: input,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    const formattedForGemini: GeminiRequest["contents"] = updatedMessages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    if (parsedPdfText.trim()) {
      const lastIndex = formattedForGemini.length - 1;
      formattedForGemini[lastIndex].parts[0].text += `\n\n[PDF Content]:\n${parsedPdfText}`;
    }

    try {
      const response = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contents: formattedForGemini }),
      });

      const data: GeminiResponse = await response.json();

      const aiText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        "Sorry, I couldn't understand that.";

      const aiMessage: Message = {
        id: Date.now() + 1,
        role: "ai",
        content: aiText,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now() + 1,
        role: "ai",
        content: "Something went wrong. Please try again later.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full max-w-3xl mx-auto p-4 bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100">
      <div className="text-center mb-6">
        <h1 className="text-5xl font-extrabold text-purple-700 mb-2 drop-shadow-md">✨ Quibly</h1>
        <p className="text-gray-700 font-medium">
          Ask smart questions from your PDF with style!
        </p>
      </div>

      {uploadedFileName && (
        <p className="text-sm text-center text-green-700 font-semibold mb-2">
          📁 File: {uploadedFileName}
        </p>
      )}

      <Card className="flex-1 flex flex-col border-2 border-purple-300 shadow-lg rounded-3xl bg-white">
        <CardContent className="p-4 flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[80%] rounded-3xl px-4 py-2 text-sm whitespace-pre-wrap shadow-sm",
                    msg.role === "user"
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white self-end rounded-br-none"
                      : "bg-gradient-to-br from-gray-200 to-white text-gray-900 self-start rounded-bl-none"
                  )}
                >
                  {msg.content}
                </div>
              ))}
              {loading && (
                <div className="bg-gray-200 text-gray-800 self-start px-4 py-2 rounded-3xl text-sm animate-pulse rounded-bl-none">
                  Typing...
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2 p-4 border-t bg-gradient-to-r from-pink-200 to-purple-200 rounded-b-3xl"
        >
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something about the PDF..."
            className="flex-1 rounded-full border-none focus:ring-2 focus:ring-purple-500"
            disabled={loading}
          />
          <Button type="submit" disabled={loading} className="rounded-full bg-purple-600 hover:bg-purple-700 text-white">
            {loading ? "..." : "Send"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            variant="secondary"
            className="rounded-full bg-blue-500 hover:bg-blue-600 text-white"
          >
            Upload PDF
          </Button>
        </form>
      </Card>
    </div>
  );
}
