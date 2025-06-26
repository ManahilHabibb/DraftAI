import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PlusCircle, Save, Trash2, Edit, Sparkles, FileText, Clock } from 'lucide-react';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [drafts, setDrafts] = useState([]);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch all drafts on component mount
  useEffect(() => {
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    try {
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/api/drafts`);
      setDrafts(response.data);
    } catch (err) {
      setError('Failed to fetch drafts');
      console.error('Error fetching drafts:', err);
    }
  };

  const createNewDraft = () => {
    setCurrentDraft(null);
    setTitle('');
    setContent('');
    setError(null);
  };

  const saveDraft = async () => {
    if (!title.trim()) {
      setError('Please enter a title for your draft');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (currentDraft) {
        // Update existing draft
        const response = await axios.put(`${API_BASE_URL}/api/drafts/${currentDraft.id}`, {
          title,
          content
        });
        setCurrentDraft(response.data);
      } else {
        // Create new draft
        const response = await axios.post(`${API_BASE_URL}/api/drafts`, {
          title,
          content
        });
        setCurrentDraft(response.data);
      }

      await fetchDrafts();
      setError(null);
    } catch (err) {
      setError('Failed to save draft');
      console.error('Error saving draft:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDraft = (draft) => {
    setCurrentDraft(draft);
    setTitle(draft.title);
    setContent(draft.content);
    setError(null);
  };

  const deleteDraft = async (draftId) => {
    if (!window.confirm('Are you sure you want to delete this draft?')) {
      return;
    }

    try {
      setError(null);
      await axios.delete(`${API_BASE_URL}/api/drafts/${draftId}`);
      await fetchDrafts();
      
      if (currentDraft && currentDraft.id === draftId) {
        createNewDraft();
      }
    } catch (err) {
      setError('Failed to delete draft');
      console.error('Error deleting draft:', err);
    }
  };

  const generateAIContent = async () => {
    if (!aiPrompt.trim()) {
      setError('Please enter a prompt for AI generation');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      const response = await axios.post(`${API_BASE_URL}/api/ai/generate`, {
        prompt: aiPrompt,
        max_tokens: 150
      });

      const generatedText = response.data.generated_text;
      setContent(prevContent => prevContent + '\n\n' + generatedText);
      setAiPrompt('');
    } catch (err) {
      setError('Failed to generate AI content');
      console.error('Error generating AI content:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <h1 className="ml-2 text-2xl font-bold text-gray-900">DraftAI</h1>
            </div>
            <button
              onClick={createNewDraft}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              New Draft
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Drafts List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Drafts</h2>
              <div className="space-y-3">
                {drafts.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No drafts yet. Create your first draft!</p>
                ) : (
                  drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        currentDraft && currentDraft.id === draft.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => loadDraft(draft)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 truncate">{draft.title}</h3>
                          <p className="text-sm text-gray-500 mt-1 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatDate(draft.updated_at)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDraft(draft.id);
                          }}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  {currentDraft ? 'Edit Draft' : 'New Draft'}
                </h2>
                <button
                  onClick={saveDraft}
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your draft title..."
                  />
                </div>

                <div>
                  <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                    Content
                  </label>
                  <textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Start writing your draft..."
                  />
                </div>

                {/* AI Assistant */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
                    AI Writing Assistant
                  </h3>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Tell AI what to write..."
                      onKeyPress={(e) => e.key === 'Enter' && generateAIContent()}
                    />
                    <button
                      onClick={generateAIContent}
                      disabled={isGenerating}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    >
                      {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;