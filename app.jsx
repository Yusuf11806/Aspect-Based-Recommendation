import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection } from 'firebase/firestore';
import { Film, Bookmark, Check, Sparkles, Star, Trash2, Clapperboard, Loader2, Search, SlidersHorizontal, User, LogOut, X } from 'lucide-react';


const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'aspect-movie-tracker-glass';


const ASPECT_COLORS = {
  acting: "bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.4)]",
  cinematography: "bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.4)]",
  plot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]",
  soundtrack: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
};

const DEFAULT_POSTER = "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=400&h=600";

export default function App() {
  const [user, setUser] = useState(null);
  const [trackedMovies, setTrackedMovies] = useState({}); 
  const [isDbLoading, setIsDbLoading] = useState(true);
  

  const [moviesDB, setMoviesDB] = useState([]);
  const [isMoviesLoading, setIsMoviesLoading] = useState(true);
  const [dbLoadError, setDbLoadError] = useState('');


  const [activeTab, setActiveTab] = useState('discover'); // 'discover' or 'library'
  const [libraryFilter, setLibraryFilter] = useState('all');


  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aspectFilters, setAspectFilters] = useState({ acting: 0, cinematography: 0, plot: 0, soundtrack: 0 });
  const [searchedTitle, setSearchedTitle] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultLimit, setResultLimit] = useState(20);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

 
  useEffect(() => {
    const fetchExternalDatabase = async () => {
      try {
 
        const response = await fetch('/movies.json'); 
        
        if (!response.ok) {
            throw new Error("Could not find movies.json. Did you put it in the public folder?");
        }

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          setMoviesDB(data);
          setIsMoviesLoading(false);
        }
      } catch (err) {
        console.error("Database Error:", err);
        setDbLoadError("Database not found. Please run the Python script on your CSV, generate movies.json, and put it in your public folder.");
        setIsMoviesLoading(false);
      }
    };
    
    fetchExternalDatabase();
  }, []);

 
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setIsDbLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const moviesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'movies');
    
    const unsubscribe = onSnapshot(moviesRef, (snapshot) => {
      const movies = {};
      snapshot.forEach(doc => {
        movies[doc.id] = { id: doc.id, ...doc.data() };
      });
      setTrackedMovies(movies);
      setIsDbLoading(false);
    }, (error) => {
      console.error("Firebase sync error:", error);
      setIsDbLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const saveToFirebase = async (movie, status) => {
    if (!user) return;
    try {
      const movieDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'movies', movie.id);
      await setDoc(movieDocRef, {
        ...movie,
        status,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("Error saving movie:", err);
    }
  };

  const removeFromFirebase = async (movieId) => {
    if (!user) return;
    try {
      const movieDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'movies', movieId);
      await deleteDoc(movieDocRef);
    } catch (err) {
      console.error("Error removing movie:", err);
    }
  };


  const handleAIAnalysis = async () => {
    if (!searchQuery.trim()) return;
    setIsAnalyzing(true);
    setErrorMsg('');
    
    try {
      const apiKey = ""; 
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
      
      const payload = {
        contents: [{ 
          parts: [{ 
            text: `Analyze the following movie request. 
            User request: "${searchQuery}"
            
            Return ONLY a valid JSON object. 
            1. Extract the minimum desired aspect scores (0-100) based on the user's emphasis. If an aspect isn't heavily emphasized, set its value to 0. If they want a masterpiece in a category, give it 90+.
            2. If the user explicitly mentions a specific movie title or franchise (e.g. "Dune", "Fight Club"), extract it into the 'title' field. If no specific title is mentioned, leave it as an empty string "".
            
            Aspects: acting, cinematography, plot, soundtrack, title.`
          }] 
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              acting: { type: "INTEGER" },
              cinematography: { type: "INTEGER" },
              plot: { type: "INTEGER" },
              soundtrack: { type: "INTEGER" },
              title: { type: "STRING" }
            },
            required: ["acting", "cinematography", "plot", "soundtrack", "title"]
          }
        }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("API request failed");
      
      const result = await response.json();
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResponse) throw new Error("Invalid AI response");

      const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      const filters = {
        acting: parsed.acting || 0,
        cinematography: parsed.cinematography || 0,
        plot: parsed.plot || 0,
        soundtrack: parsed.soundtrack || 0
      };
      
      const titleMatch = parsed.title || '';

      setAspectFilters(filters);
      setSearchedTitle(titleMatch);
      setHasSearched(true);

      const results = moviesDB.filter(movie => {
        const matchesTitle = titleMatch ? movie.title.toLowerCase().includes(titleMatch.toLowerCase()) : true;
        return matchesTitle && (
          movie.aspects.acting >= filters.acting &&
          movie.aspects.cinematography >= filters.cinematography &&
          movie.aspects.plot >= filters.plot &&
          movie.aspects.soundtrack >= filters.soundtrack
        );
      });
      
      setRecommendations(results);
    } catch (err) {
      console.error("AI Analysis failed:", err);
      setErrorMsg("Failed to analyze request. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setShowAuthModal(false);
      setEmail('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      await signInAnonymously(auth); 
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAIAnalysis();
    }
  };


  const libraryDisplayMovies = useMemo(() => {
    const moviesArray = Object.values(trackedMovies).sort((a, b) => b.timestamp - a.timestamp);
    if (libraryFilter === 'all') return moviesArray;
    return moviesArray.filter(m => m.status === libraryFilter);
  }, [trackedMovies, libraryFilter]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-500/30 selection:text-indigo-900 pb-20 relative overflow-hidden">
      

      <div className="fixed top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-indigo-300/40 blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-rose-300/30 blur-[120px] pointer-events-none"></div>
      <div className="fixed top-[40%] left-[60%] w-[40%] h-[40%] rounded-full bg-emerald-300/30 blur-[100px] pointer-events-none"></div>

  
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

          <div className="flex items-center space-x-3 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center backdrop-blur-md shadow-sm overflow-hidden p-1">
              <img src="image_2ab439.png" alt="PeakM Logo" className="w-full h-full object-contain mix-blend-multiply opacity-80" />
            </div>
            <span className="font-semibold text-xl tracking-tight text-slate-900 hidden sm:block">
              Peak<span className="text-indigo-500 font-light">M</span>
            </span>
          </div>


          <div className="flex justify-center flex-none">
            <div className="flex bg-slate-100/80 rounded-full p-1 border border-slate-200 shadow-inner backdrop-blur-md">
              <NavButton 
                icon={<Search size={16} />} 
                label="Search" 
                isActive={activeTab === 'discover'} 
                onClick={() => setActiveTab('discover')} 
              />
              <NavButton 
                icon={<Bookmark size={16} />} 
                label="Library" 
                isActive={activeTab === 'library'} 
                onClick={() => setActiveTab('library')} 
                count={Object.keys(trackedMovies).length}
              />
            </div>
          </div>

 
          <div className="flex items-center justify-end flex-1">
            {user && !user.isAnonymous ? (
              <button 
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                title="Sign Out"
              >
                <LogOut size={16} className="hidden sm:block" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
              >
                <User size={16} className="hidden sm:block" />
                <span>Sign In</span>
              </button>
            )}
          </div>

        </div>
      </nav>


      <main className="max-w-7xl mx-auto px-6 py-10 relative z-10">
        {activeTab === 'discover' ? (
          <div className="flex flex-col lg:flex-row gap-8 xl:gap-12">
            

            <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0">
              <div className="bg-white/80 backdrop-blur-2xl border border-slate-200/60 rounded-3xl p-6 sticky top-28 shadow-xl shadow-slate-200/50">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <Sparkles size={20} className="text-indigo-500" />
                    <h2 className="text-lg font-semibold text-slate-800 tracking-wide">Search</h2>
                  </div>
                </div>
                
                <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                  Describe exactly what kind of movie you're in the mood for to find your perfect match.
                </p>
                
                <div className="relative group mb-4">
                  <textarea
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. I want a visually stunning movie with an incredible original score and decent acting."
                    className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 resize-none transition-all shadow-inner backdrop-blur-md"
                  />
                </div>
                
                <div className="mb-6 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-inner">
                  <label htmlFor="resultLimit" className="text-sm font-medium text-slate-700 ml-1">
                    Max Results:
                  </label>
                  <input
                    id="resultLimit"
                    type="number"
                    min="1"
                    max="1000"
                    value={resultLimit}
                    onChange={(e) => {
                      const val = e.target.value;
                      setResultLimit(val === '' ? '' : Math.max(1, Number(val)));
                    }}
                    onBlur={() => {
                      if (!resultLimit || resultLimit < 1) setResultLimit(20);
                    }}
                    className="w-20 bg-white border border-slate-200 rounded-xl p-1.5 text-sm text-center text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                  />
                </div>

                {errorMsg && (
                  <p className="text-rose-500 text-sm mb-4 px-2">{errorMsg}</p>
                )}

                {dbLoadError && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-medium">
                    {dbLoadError}
                  </div>
                )}

                <button 
                  onClick={handleAIAnalysis}
                  disabled={isAnalyzing || !searchQuery.trim() || isMoviesLoading || moviesDB.length === 0}
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-[0_4px_20px_rgba(79,70,229,0.3)]"
                >
                  {isAnalyzing ? (
                     <><Loader2 className="animate-spin w-4 h-4" /> Finding...</>
                  ) : (
                     "Finding"
                  )}
                </button>

                {(aspectFilters.acting > 0 || aspectFilters.cinematography > 0 || aspectFilters.plot > 0 || aspectFilters.soundtrack > 0 || searchedTitle) && (
                  <div className="mt-8 pt-6 border-t border-slate-200 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center space-x-2 mb-4">
                      <SlidersHorizontal size={14} className="text-slate-400" />
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Filters</p>
                    </div>

                    {searchedTitle && (
                      <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex justify-between items-center">
                        <span className="text-xs font-medium text-indigo-600">Title Match:</span>
                        <span className="text-sm font-bold text-indigo-900">"{searchedTitle}"</span>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {Object.keys(aspectFilters).map((aspect) => (
                        <div key={aspect}>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-medium capitalize text-slate-600">{aspect}</span>
                            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{aspectFilters[aspect]}+</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/50">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${ASPECT_COLORS[aspect]}`} 
                              style={{ width: `${aspectFilters[aspect]}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={() => {
                        setAspectFilters({ acting: 0, cinematography: 0, plot: 0, soundtrack: 0 });
                        setSearchedTitle('');
                        setSearchQuery('');
                        setRecommendations([]);
                        setHasSearched(false);
                      }}
                      className="w-full mt-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-sm font-medium text-slate-600 transition-colors"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Results Grid */}
            <div className="w-full flex-1">
                <div className="flex items-center justify-between mb-6 px-1">
                  <h3 className="text-xl font-semibold text-slate-800 tracking-tight">
                    Recommendations
                  </h3>
                  {hasSearched && (
                    <span className="text-sm text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 font-medium animate-in fade-in">
                      {Math.min(recommendations.length, Number(resultLimit) || recommendations.length)} matches
                    </span>
                  )}
                </div>

                {!hasSearched ? (
                  <div className="flex flex-col items-center justify-center py-32 bg-white/60 border border-slate-200 backdrop-blur-2xl rounded-3xl shadow-sm animate-in fade-in">
                    <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-indigo-500" />
                    </div>
                    <p className="text-lg font-medium text-slate-800">Ready to Search</p>
                    <p className="text-sm text-slate-500 mt-2 max-w-sm text-center leading-relaxed">
                      You can find any kind of movie you want.
                    </p>
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-32 bg-white/60 border border-slate-200 backdrop-blur-2xl rounded-3xl shadow-sm animate-in fade-in zoom-in-95">
                    <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-lg font-medium text-slate-700">No perfect matches found</p>
                    <p className="text-sm text-slate-500 mt-1">Try adjusting your description to be less restrictive.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {recommendations.slice(0, Number(resultLimit) || recommendations.length).map(movie => (
                      <MovieCard 
                        key={movie.id} 
                        movie={movie} 
                        trackedData={trackedMovies[movie.id]}
                        onSave={saveToFirebase}
                        onRemove={removeFromFirebase}
                      />
                    ))}
                  </div>
                )}
              </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 pb-6">
              <div>
                <h2 className="text-3xl font-semibold text-slate-800 tracking-tight">Your Library</h2>
                <p className="text-slate-500 mt-2 text-sm">Movies you've saved and watched.</p>
              </div>
              
              <div className="flex bg-slate-100/80 rounded-full p-1 border border-slate-200 shadow-inner backdrop-blur-md">
                <FilterButton label="All" active={libraryFilter === 'all'} onClick={() => setLibraryFilter('all')} />
                <FilterButton label="Watchlist" active={libraryFilter === 'watchlist'} onClick={() => setLibraryFilter('watchlist')} />
                <FilterButton label="Watched" active={libraryFilter === 'watched'} onClick={() => setLibraryFilter('watched')} />
              </div>
            </div>

            {isDbLoading ? (
              <div className="py-32 flex justify-center"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
            ) : libraryDisplayMovies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 bg-white/60 border border-slate-200 backdrop-blur-2xl rounded-3xl shadow-sm">
                <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center mb-4">
                  <Film className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-lg font-medium text-slate-700">Your library is empty</p>
                <button 
                  onClick={() => setActiveTab('discover')} 
                  className="mt-6 px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all text-sm font-semibold shadow-[0_4px_15px_rgba(79,70,229,0.3)]"
                >
                  Search Movies
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {libraryDisplayMovies.map(movie => (
                  <MovieCard 
                    key={movie.id} 
                    movie={movie} 
                    trackedData={movie}
                    onSave={saveToFirebase}
                    onRemove={removeFromFirebase}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>


      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAuthModal(false)}></div>
          <div className="bg-white rounded-3xl p-8 max-w-md w-full relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              {isSignUp ? 'Create an Account' : 'Welcome Back'}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              {isSignUp ? 'Sign up to sync your watchlist across all devices.' : 'Sign in to access your saved movies.'}
            </p>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                  placeholder="••••••••"
                />
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-medium">
                  {authError}
                </div>
              )}

              <button 
                type="submit"
                disabled={isAuthLoading}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold transition-all shadow-[0_4px_15px_rgba(79,70,229,0.3)] disabled:opacity-50 flex items-center justify-center"
              >
                {isAuthLoading ? <Loader2 className="animate-spin w-4 h-4" /> : (isSignUp ? 'Sign Up' : 'Sign In')}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button 
                onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}
                className="text-indigo-600 font-semibold hover:underline"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



function NavButton({ icon, label, isActive, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
        isActive 
          ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 border border-transparent'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`ml-1.5 text-xs py-0.5 px-2 rounded-full ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function FilterButton({ label, active, onClick }) {
  return (
    <button 
      onClick={onClick} 
      className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
        active 
          ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 border border-transparent'
      }`}
    >
      {label}
    </button>
  );
}

function MovieCard({ movie, trackedData, onSave, onRemove }) {
  const status = trackedData?.status || 'none';
  
  const avgScore = useMemo(() => {
    if (!movie.aspects) return 0;
    const scores = Object.values(movie.aspects);
    if (scores.length === 0) return 0;
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  }, [movie.aspects]);

  return (
    <div className="bg-white/80 backdrop-blur-2xl rounded-3xl overflow-hidden border border-slate-200/60 hover:border-indigo-300/50 transition-all duration-500 group shadow-lg shadow-slate-200/40 hover:shadow-xl hover:shadow-indigo-100 flex flex-col h-full relative">
      

      <div className="relative h-72 overflow-hidden bg-slate-200 rounded-t-3xl border-b border-slate-100">
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/10 z-10"></div>
        <img 
          src={movie.poster} 
          alt={movie.title} 
          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out opacity-95 group-hover:opacity-100"
          loading="lazy"
          onError={(e) => { e.target.src = DEFAULT_POSTER; }}
        />
        

        {status !== 'none' && (
          <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-md text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-full border border-slate-200 flex items-center shadow-sm">
            {status === 'watched' ? (
              <><Check size={12} className="mr-1.5 text-emerald-500" /> <span className="text-emerald-600">Watched</span></>
            ) : (
              <><Bookmark size={12} className="mr-1.5 text-indigo-500" /> <span className="text-indigo-600">Watchlist</span></>
            )}
          </div>
        )}

        {/* Quick Actions overlay */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
          {status !== 'watchlist' && (
            <button 
              onClick={() => onSave(movie, 'watchlist')}
              className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 shadow-md transition-all"
              title="Add to Watchlist"
            >
              <Bookmark size={16} />
            </button>
          )}
          {status !== 'watched' && (
            <button 
              onClick={() => onSave(movie, 'watched')}
              className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 shadow-md transition-all"
              title="Mark Watched"
            >
              <Check size={16} />
            </button>
          )}
          {status !== 'none' && (
            <button 
              onClick={() => onRemove(movie.id)}
              className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 shadow-md transition-all"
              title="Remove from Library"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>


      <div className="p-6 flex-grow flex flex-col z-20 -mt-8 relative bg-gradient-to-b from-transparent to-white/50">
        <div className="flex justify-between items-start mb-1 gap-3">
          <h3 className="font-bold text-lg text-slate-900 leading-tight drop-shadow-sm">{movie.title}</h3>
          <div className="flex items-center justify-center bg-white/90 backdrop-blur-md text-amber-600 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-amber-100 shrink-0 shadow-sm">
            <Star size={12} className="text-amber-500 mr-1.5 fill-amber-500" />
            {avgScore}
          </div>
        </div>
        <p className="text-slate-500 font-medium text-sm mb-6">{movie.year}</p>

        <div className="space-y-4 mt-auto">
          {movie.aspects && Object.entries(movie.aspects).map(([aspect, score]) => (
            <div key={aspect}>
              <div className="flex justify-between text-[11px] font-bold mb-1.5 uppercase tracking-wider">
                <span className="text-slate-500">{aspect}</span>
                <span className="text-slate-700">{score}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/50">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${ASPECT_COLORS[aspect.toLowerCase()] || 'bg-slate-400'}`} 
                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
