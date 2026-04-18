import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";

const initialState = {
  semanticResults: [],
  recommendations: {
    mayLike: [],
    trending: [],
  },
  quickReorder: [],
  chatMessages: [],
  loading: false,
  chatLoading: false,
  error: "",
};

export const semanticSearchAi = createAsyncThunk("ai/semanticSearch", async ({ query, restaurantId }) => {
  const response = await api.post("/ai/semantic-search", {
    query,
    restaurantId,
    limit: 12,
  });
  return response.data.data;
});

export const fetchAiRecommendations = createAsyncThunk("ai/recommendations", async (restaurantId) => {
  const response = await api.get("/ai/recommendations", {
    params: restaurantId ? { restaurantId } : undefined,
  });
  return response.data.data;
});

export const fetchQuickReorder = createAsyncThunk("ai/quickReorder", async () => {
  const response = await api.get("/ai/quick-reorder");
  return response.data.data;
});

const aiSlice = createSlice({
  name: "ai",
  initialState,
  reducers: {
    addUserChatMessage(state, action) {
      state.chatMessages.push({ role: "user", content: action.payload });
    },
    startAssistantMessage(state) {
      state.chatLoading = true;
      state.chatMessages.push({ role: "assistant", content: "" });
    },
    appendAssistantChunk(state, action) {
      const last = state.chatMessages[state.chatMessages.length - 1];
      if (last && last.role === "assistant") {
        last.content += action.payload;
      }
    },
    completeAssistantMessage(state) {
      state.chatLoading = false;
    },
    clearSemanticResults(state) {
      state.semanticResults = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(semanticSearchAi.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(semanticSearchAi.fulfilled, (state, action) => {
        state.loading = false;
        state.semanticResults = action.payload;
      })
      .addCase(semanticSearchAi.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Semantic search failed";
      })
      .addCase(fetchAiRecommendations.fulfilled, (state, action) => {
        state.recommendations = action.payload;
      })
      .addCase(fetchQuickReorder.fulfilled, (state, action) => {
        state.quickReorder = action.payload;
      });
  },
});

export const {
  addUserChatMessage,
  startAssistantMessage,
  appendAssistantChunk,
  completeAssistantMessage,
  clearSemanticResults,
} = aiSlice.actions;

export default aiSlice.reducer;
