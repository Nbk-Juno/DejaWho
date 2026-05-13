import { ArrowLeft, Loader2, Mic, MicOff, Search, Sparkles, AlertCircle, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EncounterCard } from "@/components/encounter-card";
import { useLocation } from "wouter";
import { useVoiceSearch } from "@/hooks/use-voice-search";

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const {
    query,
    setQuery,
    isSearching,
    isError,
    searchError,
    searchResults,
    isVoiceMode,
    isPlayingAudio,
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    stopAudio,
    replayAudio,
    handleSearch,
  } = useVoiceSearch();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Find Someone</h1>
          </div>

          <form onSubmit={handleSearch}>
            <div className="relative flex items-center h-16 bg-background border border-input rounded-md px-4 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <input
                type="search"
                placeholder="Ask me anything... e.g., 'Who did I meet at Starbucks last Tuesday?'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 px-3 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
                data-testid="input-search"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="flex-shrink-0 relative"
                disabled={isTranscribing}
                onClick={() => (isRecording ? stopRecording() : startRecording())}
                data-testid="button-voice-record"
              >
                {isTranscribing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isRecording ? (
                  <>
                    <MicOff className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full animate-pulse" />
                  </>
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
              <Button
                type="submit"
                size="default"
                className="flex-shrink-0 ml-2"
                disabled={isSearching || !query.trim()}
                data-testid="button-search"
              >
                {isSearching ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                    Searching...
                  </>
                ) : (
                  "Search"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isSearching && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-primary">
              <Sparkles className="h-6 w-6 animate-pulse" />
              <p className="text-lg font-medium">AI is searching your memories...</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-48 rounded-xl bg-card animate-pulse"
                  data-testid={`skeleton-result-${i}`}
                ></div>
              ))}
            </div>
          </div>
        )}

        {isError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-8">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-destructive">Search Failed</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchError?.message ||
                      "We couldn't complete your search. Please try again or rephrase your query."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {searchResults && !isSearching && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {searchResults.naturalLanguageResponse && (
              <Card className="bg-gradient-to-br from-primary/5 to-chart-2/5 border-primary/20">
                <CardContent className="py-6">
                  <div className="flex gap-4">
                    <Sparkles className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-foreground">AI Response</h3>
                        {isVoiceMode && isPlayingAudio && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={stopAudio}
                            className="h-6 px-2"
                            data-testid="button-stop-audio"
                          >
                            <VolumeX className="h-4 w-4 mr-1" />
                            <span className="text-xs">Stop</span>
                          </Button>
                        )}
                        {isVoiceMode && !isPlayingAudio && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={replayAudio}
                            className="h-6 px-2"
                            data-testid="button-replay-audio"
                          >
                            <Volume2 className="h-4 w-4 mr-1" />
                            <span className="text-xs">Replay</span>
                          </Button>
                        )}
                      </div>
                      <p className="text-foreground leading-relaxed" data-testid="text-ai-response">
                        {searchResults.naturalLanguageResponse}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {searchResults.results && searchResults.results.length > 0 ? (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">
                  {searchResults.results.length === 1
                    ? "1 Match Found"
                    : `${searchResults.results.length} Matches Found`}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {searchResults.results.map(({ encounter, score }) => (
                    <div key={encounter.id} className="relative">
                      <EncounterCard encounter={encounter} />
                      <div className="absolute top-3 right-3">
                        <div className="px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                          <span className="text-xs font-medium text-primary" data-testid={`text-score-${encounter.id}`}>
                            {Math.round(score * 100)}% match
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Matches Found</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-6">
                    We couldn't find anyone matching your search. Try different terms or check if the
                    encounter has been recorded.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setQuery("")}
                      data-testid="button-try-again"
                    >
                      Try Different Terms
                    </Button>
                    <Button
                      onClick={() => setLocation("/record")}
                      data-testid="button-record-new"
                    >
                      Record New Encounter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!searchResults && !isSearching && !isError && (
          <div className="text-center py-16 space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20 flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">AI-Powered Search</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Ask natural questions like "Who did I meet at the conference?" or "Who was that person
                from the coffee shop?"
              </p>
            </div>
            <div className="pt-4 space-y-2 max-w-md mx-auto">
              <p className="text-sm font-medium text-foreground">Try these examples:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "Who did I meet last week?",
                  "Find people from San Diego",
                  "Who talked about sailing?",
                ].map((example) => (
                  <Button
                    key={example}
                    variant="outline"
                    size="sm"
                    onClick={() => setQuery(example)}
                    className="text-xs"
                    data-testid={`button-example-${example.split(" ")[0].toLowerCase()}`}
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
