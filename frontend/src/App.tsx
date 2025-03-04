import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, BookOpen, Briefcase, Linkedin, MessageSquare, X, ChevronRight, Loader2 } from 'lucide-react';
import axios from 'axios';

// Define TypeScript interfaces for our data
interface Speaker {
  full_name: string;
  title: string;
  company: string;
  bio: string;
  photo_url: string;
  linkedin_url: string;
  sessions: any;
  similarity: number;
}

// Interface for processed speaker data
interface ProcessedSpeaker {
  id: number;
  name: string;
  title: string;
  company: string;
  bio: string;
  image: string;
  linkedin: string;
  sessions: {
    title: string;
    role: string;
    url: string;
  }[];
  similarityScore: number;
}

const GTCSpeakerSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<ProcessedSpeaker[]>([]);
  const [remainingSearches, setRemainingSearches] = useState(3);
  const [selectedSpeaker, setSelectedSpeaker] = useState<ProcessedSpeaker | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch remaining searches count when component mounts
  useEffect(() => {
    const fetchRemainingSearches = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/remaining-searches`);
        setRemainingSearches(response.data.remaining_searches);
      } catch (error) {
        console.error("Error fetching remaining searches:", error);
        // If we can't connect to the backend, assume max searches available
        setRemainingSearches(3);
      }
    };
    
    fetchRemainingSearches();
  }, []);
  
  // Process the raw speaker data from the backend
  const processSpeakerData = (speakers: Speaker[]): ProcessedSpeaker[] => {
    return speakers.map((speaker, index) => {
      // Process sessions - ensure it's an array
      const sessionsList = speaker.sessions && Array.isArray(speaker.sessions) 
        ? speaker.sessions 
        : [];

      return {
        id: index + 1, // Generate an ID since we don't have one from the backend
        name: speaker.full_name,
        title: speaker.title || '',
        company: speaker.company || '',
        bio: speaker.bio || '',
        image: speaker.photo_url || '',
        linkedin: speaker.linkedin_url || '',
        sessions: sessionsList,
        similarityScore: speaker.similarity || 0
      };
    });
  };
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (searchQuery.trim() && remainingSearches > 0) {
      setIsLoading(true);
      setError(null);
      setSearchResults([]); // Reset previous results
  
      try {
        const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/search`, {
          query: searchQuery,
          top_k: 5
        });
  
        console.log("📩 Full backend response:", response);
        console.log("📩 response.data (raw):", response.data);
  
        // Handle updated response structure with results and remaining_searches
        const responseData = response.data;
        let speakerData = responseData.results || [];
        
        // Update remaining searches from response
        if (responseData.remaining_searches !== undefined) {
          setRemainingSearches(responseData.remaining_searches);
        }
  
        if (typeof speakerData === "string") {
          console.warn("⚠️ response.data is a string! Parsing it...");
          speakerData = JSON.parse(speakerData);
        }
  
        console.log("🔄 Extracted speaker data:", speakerData);
  
        if (!Array.isArray(speakerData)) {
          console.error("❌ API response is not an array:", speakerData);
          setError("Invalid API response format.");
          return;
        }
  
        // Process the data
        const processedResults = processSpeakerData(speakerData);
        console.log("🔄 Processed search results:", processedResults);
  
        setSearchResults([...processedResults]);
        setHasSearched(true);
      } catch (error: any) {
        console.error("❌ Search error:", error);
        
        // Check if this is a rate limit (429) error
        if (error.response && error.response.status === 429) {
          setError("You've reached your search limit. Try again later.");
          setRemainingSearches(0);
        } else {
          setError("An error occurred while searching. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    }
  };  
    

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12">
        {/* Logo and Header */}
        <div className="mb-12 flex flex-col items-center">
          <div className="mb-5 shadow-lg transform hover:scale-105 transition-transform duration-300 rounded-2xl overflow-hidden w-24 h-24">
            <img 
              src="/logo_walnut.webp" 
              alt="Company Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold mb-3 text-gray-800 tracking-tight text-center">Find GTC speakers</h1>
          <p className="text-xl text-gray-600 text-center max-w-2xl">Discover world-class speakers with our smart semantic search</p>
        </div>
        
        {/* Search Form */}
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-md p-6 mb-12">
          <form onSubmit={handleSearch} className="w-full">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <span className="absolute inset-y-0 left-4 flex items-center">
                  <Search size={20} className="text-purple-500" />
                </span>
                <input
                  type="text"
                  className="w-full py-3 pl-12 pr-4 border-2 border-purple-100 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-700 bg-purple-50 shadow-sm"
                  placeholder="Search for speakers by name, expertise, company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={remainingSearches === 0 || isLoading}
                className="w-full md:w-auto px-8 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 font-medium shadow-md transform hover:-translate-y-1 transition-all duration-200 flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  'Search'
                )}
              </button>
            </div>
            
            <div className="mt-4 flex justify-center">
              <div className="text-sm">
                <span className={`font-medium ${remainingSearches === 0 ? 'text-red-500' : 'text-purple-600'}`}>
                  {remainingSearches}/3
                </span>
                <span className="text-gray-600 ml-1">free searches</span>
                {remainingSearches === 0 && (
                  <span className="ml-2 text-red-500">
                    (Limit based on your IP address)
                  </span>
                )}
              </div>
            </div>
          </form>
        </div>
        
        {/* Results or Empty State */}
        {!hasSearched ? (
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">Start your search</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Enter a query to find relevant speakers. You can search by name, expertise, topic, or any other relevant keywords.
              </p>
              <div className="mt-6 flex justify-center">
                <div className="bg-purple-50 text-purple-700 px-4 py-3 rounded-lg max-w-md text-sm">
                  <p className="font-medium">Pro tip:</p>
                  <p>Try searching for specific technologies, research areas, or industry expertise to find the most relevant speakers.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            {error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 mb-8">
                <h2 className="text-xl font-bold mb-2">Error</h2>
                <p>{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Search Results</h2>
                  <p className="text-gray-600">Found {searchResults.length} speakers matching your search</p>
                </div>
                
                {searchResults.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-md p-8 text-center">
                    <p className="text-gray-600">No speakers found matching your search criteria.</p>
                    <button 
                      onClick={() => {
                        setHasSearched(false);
                        setSearchQuery('');
                      }}
                      className="mt-4 px-6 py-2 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
                    >
                      Try a different search
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {searchResults.map(speaker => (
                      <div 
                        key={speaker.id} 
                        className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group relative"
                        onClick={() => setSelectedSpeaker(speaker)}
                      >
                        <div className="flex flex-col md:flex-row gap-6">
                          {/* Speaker Image */}
                          <div className="flex-shrink-0">
                            <div className="w-24 h-24 rounded-lg overflow-hidden shadow-md">
                              <img 
                                src={speaker.image} 
                                alt={speaker.name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback for broken images
                                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&h=256&q=80";
                                }}
                              />
                            </div>
                          </div>
                          
                          {/* Speaker Info */}
                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-2">
                              <div>
                                <h3 className="font-bold text-xl text-gray-800">{speaker.name}</h3>
                                <div className="flex items-center text-gray-700 mt-1">
                                  <Briefcase size={16} className="mr-2 text-purple-500" />
                                  <span className="font-medium">{speaker.title}</span>
                                  {speaker.company && (
                                    <>
                                      <span className="mx-1">-</span>
                                      <span>{speaker.company}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              {/* LinkedIn Link */}
                              {speaker.linkedin && (
                                <a 
                                  href={speaker.linkedin}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-2 sm:mt-0 inline-flex items-center px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                                >
                                  <Linkedin size={16} className="mr-1.5" />
                                  LinkedIn
                                </a>
                              )}
                            </div>
                            
                            {/* Bio */}
                            <div className="mt-3">
                              <div className="flex items-start">
                                <BookOpen size={16} className="mr-2 text-purple-500 mt-1 flex-shrink-0" />
                                <p className="text-gray-700">{speaker.bio.substring(0, 200)}...</p>
                              </div>
                            </div>
                            
                            {/* Sessions */}
                            {speaker.sessions && speaker.sessions.length > 0 && (
                              <div className="mt-4">
                                <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                                  <MessageSquare size={16} className="mr-2 text-purple-500" />
                                  Sessions:
                                </h4>
                                <ul className="space-y-2">
                                  {speaker.sessions.map((session, index) => (
                                    <li key={index} className="pl-4 border-l-2 border-purple-200">
                                      <div className="text-gray-800">
                                        {session.title} 
                                        {session.role && <span className="text-gray-600"> ({session.role})</span>}
                                      </div>
                                      
                                      {/* "View Session Details" button - styled like in the modal */}
                                      {session.url && (
                                        <a 
                                          href={session.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex items-center mt-2 text-purple-600 hover:text-purple-800 transition-colors"
                                        >
                                          <ExternalLink size={14} className="mr-1.5" />
                                          View Session Details
                                        </a>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Similarity Score and View Details on the same line */}
                            <div className="mt-4 flex items-center justify-between">
                              <span className="text-sm text-gray-500">
                                Similarity Score: {speaker.similarityScore.toFixed(4)}
                              </span>
                              <span className="inline-flex items-center text-sm text-purple-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                View full details
                                <ChevronRight size={16} className="ml-1" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Back to search button */}
                <div className="mt-8 flex justify-center">
                  <button 
                    onClick={() => {
                      setHasSearched(false);
                      setSearchQuery('');
                    }}
                    className="px-6 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors flex items-center"
                  >
                    <Search size={16} className="mr-2" />
                    New Search
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Speaker Detail Modal/Popup */}
      {selectedSpeaker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedSpeaker(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X size={20} className="text-gray-700" />
            </button>
            
            <div className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Speaker Image */}
                <div className="flex-shrink-0">
                  <div className="w-32 h-32 rounded-lg overflow-hidden shadow-md mx-auto md:mx-0">
                    <img 
                      src={selectedSpeaker.image} 
                      alt={selectedSpeaker.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback for broken images
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&h=256&q=80";
                      }}
                    />
                  </div>
                </div>
                
                {/* Speaker Info */}
                <div className="flex-1">
                  <div className="flex items-center mb-4">
                    <h2 className="font-bold text-2xl text-gray-800">{selectedSpeaker.name}</h2>
                    
                    {/* LinkedIn Icon next to name */}
                    {selectedSpeaker.linkedin && (
                      <a 
                        href={selectedSpeaker.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        <Linkedin size={20} />
                      </a>
                    )}
                  </div>
                  
                  <div className="flex items-center text-gray-700 mb-4">
                    <Briefcase size={18} className="mr-2 text-purple-500" />
                    <span className="font-medium">{selectedSpeaker.title}</span>
                    {selectedSpeaker.company && (
                      <>
                        <span className="mx-1">-</span>
                        <span>{selectedSpeaker.company}</span>
                      </>
                    )}
                  </div>
                  
                  {/* Bio */}
                  <div className="mt-6">
                    <h3 className="font-medium text-lg text-gray-800 mb-2 flex items-center">
                      <BookOpen size={18} className="mr-2 text-purple-500" />
                      Biography
                    </h3>
                    <p className="text-gray-700 leading-relaxed">{selectedSpeaker.bio}</p>
                  </div>
                  
                  {/* Sessions */}
                  {selectedSpeaker.sessions && selectedSpeaker.sessions.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-medium text-lg text-gray-800 mb-3 flex items-center">
                        <MessageSquare size={18} className="mr-2 text-purple-500" />
                        Sessions
                      </h3>
                      <ul className="space-y-4">
                        {selectedSpeaker.sessions.map((session, index) => (
                          <li key={index} className="pl-5 border-l-2 border-purple-300 py-1">
                            <div className="text-gray-800 font-medium">
                              {session.title}
                            </div>
                            {session.role && (
                              <div className="text-gray-600 mt-1">
                                Role: {session.role}
                              </div>
                            )}
                            {/* Fixed to use session.url instead of session.link */}
                            {session.url && (
                              <a 
                                href={session.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center mt-2 text-purple-600 hover:text-purple-800 transition-colors"
                              >
                                <ExternalLink size={16} className="mr-1.5" />
                                View Session Details
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Similarity Score */}
                  {selectedSpeaker.similarityScore && (
                    <div className="mt-6 flex items-center">
                      <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                        Similarity Score: {selectedSpeaker.similarityScore.toFixed(4)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Footer with subtle branding */}
      <footer className="w-full mt-16 py-8 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <div className="w-8 h-8 mr-2 rounded-lg overflow-hidden">
              <img 
                src="/logo_walnut.webp" 
                alt="Company Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-gray-600">© 2025 GTC Speaker Directory</span>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="text-gray-600 hover:text-purple-600 transition-colors">Terms</a>
            <a href="#" className="text-gray-600 hover:text-purple-600 transition-colors">Privacy</a>
            <a href="#" className="text-gray-600 hover:text-purple-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default GTCSpeakerSearch;