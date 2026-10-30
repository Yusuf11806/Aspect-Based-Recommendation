import React, { useState, useEffect, useMemo } from 'react';
import { Search, Film, Heart, User, LogIn, X, Loader2, Play } from 'lucide-react';

export default function App() {
  const [database, setDatabase] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [activeTab, setActiveTab] = useState('search');
  const [watchlist, setWatchlist] = useState([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isFinding, setIsFinding] = useState(false);
  const [authForm, setAuthForm] = useState({ email: '', password: '', isLogin: true });

  useEffect(() => {
    fetch('/movies.json')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDatabase(data);
        } else if (data.movies && Array.isArray(data.movies)) {
          setDatabase(data.movies);
        } else {
          setDatabase([]);
        }
      })
      .catch(err => {
        console.error("Error loading movies:", err);
        setDatabase([]);
      });
  }, []);

  // Flexible Aspect-Based & Keyword Search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !Array.isArray(database)) return [];
    setIsFinding(true);
    
    const query = String(searchQuery).toLowerCase().trim();
    const queryWords = query.split(/\s+/).filter(Boolean);

    let results = database.filter((movie, index) => {
      if (!movie) return false;
      
      const rawTitle = movie.title || movie.Series_Title || movie.movie_title || movie.original_title || movie.name || '';
      const movieReview = String(movie.review || movie.description || movie.overview || movie.summary || movie.text || movie.plot || '').toLowerCase();
      const movieAspects = String(movie.aspects || movie.tags || movie.category || movie.sentiment || '').toLowerCase();
      
      const combinedText = `${rawTitle} ${movieReview} ${movieAspects}`;

      // Check if title matches directly, or if ANY of the typed search words/aspects match the content
      const titleMatch = String(rawTitle).toLowerCase().includes(query);
      const aspectMatch = queryWords.some(word => combinedText.includes(word));

      return titleMatch || aspectMatch;
    });
    
    setTimeout(() => setIsFinding(false), 200);
    return results.slice(0, maxResults || 20);
  }, [searchQuery, database, maxResults]);

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setCurrentUser({ email: authForm.email });
    setIsAuthModalOpen(false);
  };

  const getMovieKey = (movie, index) => String(movie.title || movie.Series_Title || movie.movie_title || movie.original_title || movie.name || index);

  const toggleWatchlist = (movie, index) => {
    const key = getMovieKey(movie, index);
    if (watchlist.find((m, i) => getMovieKey(m, i) === key)) {
      setWatchlist(watchlist.filter((m, i) => getMovieKey(m, i) !== key));
    } else {
      setWatchlist([...watchlist, movie]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col xl:flex-row">
      
      {/* Sidebar */}
      <div className="w-full xl:w-[360px] bg-white border-r border-gray-200 flex flex-col shadow-sm flex-shrink-0 z-10">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/image_2ab439.png" alt="PeakM Logo" className="h-8 w-8 mr-3 object-contain" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">PeakM</h1>
          </div>
          <button onClick={() => setIsAuthModalOpen(true)} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            {currentUser ? <User className="text-indigo-600" size={24}/> : <LogIn className="text-gray-500" size={24}/>}
          </button>
        </div>

        <div className="p-6 flex-1 flex flex-col gap-6">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('search')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'search' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Search
            </button>
            <button 
              onClick={() => setActiveTab('recommendations')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'recommendations' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Recommendations
            </button>
          </div>

          {activeTab === 'search' && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What are you looking for?</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. mind-blowing plot or aspect..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Results</label>
                <input 
                  type="number" 
                  value={maxResults}
                  onChange={(e) => setMaxResults(Number(e.target.value))}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              
              {isFinding && (
                <div className="text-blue-500 text-sm flex items-center gap-2 font-medium">
                  <Loader2 className="animate-spin" size={16}/> Finding...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 p-6 md:p-8 overflow-y-auto">
        {activeTab === 'search' ? (
          searchQuery.trim() === '' ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 pt-20">
              <Film size={64} className="opacity-20 text-blue-500" />
              <p className="text-lg font-medium text-gray-500">You can find any kind of movie you want</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((movie, idx) => (
                <MovieCard key={idx} movie={movie} index={idx} toggleWatchlist={toggleWatchlist} watchlist={watchlist} />
              ))}
            </div>
          )
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Your Recommendations</h2>
            {watchlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-gray-400 space-y-4 pt-20">
                <Heart size={64} className="opacity-20 text-red-500" />
                <p className="text-lg font-medium text-gray-500">No movies saved to your recommendations yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {watchlist.map((movie, idx) => (
                  <MovieCard key={idx} movie={movie} index={idx} toggleWatchlist={toggleWatchlist} watchlist={watchlist} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 p-8 rounded-2xl w-full max-w-md shadow-2xl relative border border-gray-100">
            <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 transition-colors">
              <X size={24}/>
            </button>
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-900">{authForm.isLogin ? 'Welcome Back' : 'Create Account'}</h2>
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <input 
                required 
                type="email" 
                placeholder="Email Address" 
                value={authForm.email} 
                onChange={e => setAuthForm({...authForm, email: e.target.value})} 
                className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50 focus:bg-white" 
              />
              <input 
                required 
                type="password" 
                placeholder="Password" 
                value={authForm.password} 
                onChange={e => setAuthForm({...authForm, password: e.target.value})} 
                className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50 focus:bg-white" 
              />
              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm">
                {authForm.isLogin ? 'Sign In' : 'Sign Up'}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-gray-600">
              {authForm.isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => setAuthForm({...authForm, isLogin: !authForm.isLogin})} className="text-blue-600 font-semibold hover:underline">
                {authForm.isLogin ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MovieCard({ movie, index, toggleWatchlist, watchlist }) {
  let rawTitle = movie.title || movie.Series_Title || movie.movie_title || movie.original_title || movie.name;
  
  // If title is missing or just numbers from row indices, format it cleanly
  const title = (rawTitle && String(rawTitle).trim() !== '' && !/^\d+$/.test(String(rawTitle)))
    ? String(rawTitle)
    : `Movie Review Item #${index + 1}`;

  const description = String(movie.review || movie.description || movie.overview || movie.summary || movie.text || movie.plot || 'No review or description available.');
  const imageUrl = movie.posterUrl || (movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=500&q=80');
  
  const movieKey = String(rawTitle || index);
  const isWatchlisted = !!watchlist.find((m, i) => String(m.title || m.Series_Title || m.movie_title || m.original_title || m.name || i) === movieKey);

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 group flex flex-col">
      <div className="h-72 w-full bg-gray-200 relative overflow-hidden">
        <img 
          src={imageUrl} 
          alt={title} 
          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" 
          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=500&q=80' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <Play className="text-white opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300 drop-shadow-md" size={48} />
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2 gap-3">
          <h3 className="font-bold text-lg leading-tight text-gray-900">{title}</h3>
          <button 
            onClick={() => toggleWatchlist(movie, index)} 
            className={`flex-shrink-0 transition-transform hover:scale-110 active:scale-95 ${isWatchlisted ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
          >
            <Heart fill={isWatchlisted ? "currentColor" : "none"} size={22} />
          </button>
        </div>
        <p className="text-sm text-gray-500 line-clamp-3 mt-auto">
          {description}
        </p>
      </div>
    </div>
  );
}
