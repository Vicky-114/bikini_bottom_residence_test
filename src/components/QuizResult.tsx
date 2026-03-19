import { HybridCharacter } from '@/types/quiz';
import { CHARACTERS } from '@/data/characters';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Share2, Box, Download, Image, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import bgImage from '@/assets/bg_bikini_bottom.jpg';
import { useTranslation } from 'react-i18next';

interface QuizResultProps {
  hybrid: HybridCharacter;
  onRestart: () => void;
  onImageGenerated?: (imageUrl: string) => void;
}

const QuizResult = ({ hybrid, onRestart, onImageGenerated }: QuizResultProps) => {
  const { toast } = useToast();
  const [generatedImage, setGeneratedImage] = useState<string | null>(hybrid.generatedImageUrl || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modelFormat, setModelFormat] = useState<'stl' | 'obj'>('stl');
  const [isGenerating3D, setIsGenerating3D] = useState(false);
  const [generated3DModel, setGenerated3DModel] = useState<string | null>(null);
  const { t } = useTranslation();
  
  // Auto-generate image on mount if not already generated
  useEffect(() => {
    if (!generatedImage && hybrid.componentBreakdown && hybrid.componentBreakdown.length >= 3) {
      generateHybridImage();
    }
  }, []);

  const handleShare = () => {
    const componentText = hybrid.componentBreakdown 
      ? hybrid.componentBreakdown.map(c => `${c.name} (${c.percentage}%)`).join(', ')
      : hybrid.components.map(k => CHARACTERS[k]?.name).join(', ');
    
    const text = `I'm ${hybrid.name}!\nThis is a unique hybrid composed of ${componentText}.\n${hybrid.description}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'My Bikini Bottom Hybrid Character',
        text,
      }).catch(() => {
        copyToClipboard(text);
      });
    } else {
      copyToClipboard(text);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t('common.copied'),
      description: t('common.shareDescription'),
    });
  };
  
  const generateHybridImage = async () => {
    if (!hybrid.componentBreakdown || hybrid.componentBreakdown.length < 3) {
      toast({
        title: "Not enough data",
        description: "Need at least 3 character components to generate image",
        variant: "destructive"
      });
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      toast({
        title: "Image generation unavailable",
        description: "This published version does not have the AI image service configured.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const top3 = hybrid.componentBreakdown.slice(0, 3);
      const shapeCharacter = CHARACTERS[top3[0].key];
      const colorCharacter = CHARACTERS[top3[1].key];
      const patternCharacter = CHARACTERS[top3[2].key];

      const { data, error } = await supabase.functions.invoke('generate-hybrid-image', {
        body: {
          shapeCharacter: { name: shapeCharacter.name, percentage: top3[0].percentage },
          colorCharacter: { name: colorCharacter.name, percentage: top3[1].percentage },
          patternCharacter: { name: patternCharacter.name, percentage: top3[2].percentage },
          userName: hybrid.name,
          printMode: 'regular'
        }
      });

      if (error) throw error;
      
      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        onImageGenerated?.(data.imageUrl);
        toast({
          title: t('result.ready'),
          description: t('result.fusionDescription', { 
            char1: shapeCharacter.name, 
            char2: colorCharacter.name, 
            char3: patternCharacter.name 
          }),
        });
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate hybrid image",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generate3DModel = async () => {
    if (!generatedImage) {
      toast({
        title: "Image required",
        description: "Please wait for the image to generate first",
        variant: "destructive"
      });
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      toast({
        title: "3D generation unavailable",
        description: "This published version does not have the 3D generation service configured.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating3D(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-3d-model', {
        body: {
          imageUrl: generatedImage,
          format: modelFormat,
          characterName: hybrid.name
        }
      });

      if (error) throw error;

      if (data?.modelUrl) {
        setGenerated3DModel(data.modelUrl);
        toast({
          title: "3D Model ready!",
          description: `Format: ${modelFormat.toUpperCase()}`,
        });
      } else if (data?.message) {
        toast({
          title: "3D Service Not Configured",
          description: data.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error generating 3D model:', error);
      toast({
        title: "3D Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate 3D model",
        variant: "destructive"
      });
    } finally {
      setIsGenerating3D(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `${hybrid.name.replace(/\s+/g, '_')}_hybrid.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const download3DModel = () => {
    if (!generated3DModel) return;
    const link = document.createElement('a');
    link.href = generated3DModel;
    link.download = `${hybrid.name.replace(/\s+/g, '_')}_model.${modelFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8 relative"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" />
      
      <Card className="relative w-full max-w-3xl p-8 md:p-12 bg-card/95 backdrop-blur-md border-primary border-4 shadow-deep overflow-y-auto max-h-[90vh]">
        <div className="text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-primary mb-4 pulse-glow">
            {t('result.title')}
          </h1>
          
          <h2 className="text-4xl md:text-6xl font-black text-foreground mb-6">
            {hybrid.name}
          </h2>
          
          {/* Main Character Display */}
          <div className="mb-6">
            {isGenerating ? (
              <div className="w-full max-w-md mx-auto p-12 bg-muted/50 rounded-lg border-4 border-primary/50">
                <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground">{t('result.generating')}</p>
                <p className="text-sm text-muted-foreground mt-2">{t('result.moment')}</p>
              </div>
            ) : generatedImage ? (
              <div className="w-full max-w-md mx-auto">
                <img 
                  src={generatedImage}
                  alt={`${hybrid.name} - AI Generated Hybrid Character`}
                  className="w-full h-auto rounded-lg border-4 border-primary shadow-glow"
                />
                {hybrid.componentBreakdown && hybrid.componentBreakdown.length >= 3 && (
                  <div className="mt-3 p-3 bg-muted/70 rounded-lg text-sm">
                    <p className="font-semibold text-primary mb-1">{t('result.fusion')}</p>
                    <p className="text-foreground">
                      {CHARACTERS[hybrid.componentBreakdown[0].key].name} ({hybrid.componentBreakdown[0].percentage}%) + {CHARACTERS[hybrid.componentBreakdown[1].key].name} ({hybrid.componentBreakdown[1].percentage}%) + {CHARACTERS[hybrid.componentBreakdown[2].key].name} ({hybrid.componentBreakdown[2].percentage}%)
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative w-48 h-48 md:w-64 md:h-64 mx-auto">
                {hybrid.components.slice(0, 3).map((charKey, idx) => (
                  <div key={charKey} className="absolute inset-0">
                    <img
                      src={CHARACTERS[charKey]?.image}
                      alt={CHARACTERS[charKey]?.name}
                      className="w-full h-full object-contain rounded-full border-4 border-primary shadow-glow transition-transform hover:scale-110"
                      style={{
                        opacity: idx === 0 ? 1 : 0.5,
                        transform: `translate(${idx * 15}px, ${idx * 15}px)`,
                        filter: idx > 0 ? `hue-rotate(${idx * 30}deg)` : 'none',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Download Actions - Only show when image is ready */}
          {generatedImage && (
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
                {/* Download Image Button */}
                <Button
                  onClick={downloadImage}
                  size="lg"
                  className="font-bold shadow-glow"
                >
                  <Image className="mr-2 h-5 w-5" />
                  {t('result.downloadImage')}
                </Button>

                {/* 3D Model Section */}
                {!generated3DModel ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={modelFormat}
                      onChange={(e) => setModelFormat(e.target.value as 'stl' | 'obj')}
                      className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="stl">STL</option>
                      <option value="obj">OBJ</option>
                    </select>
                    <Button
                      onClick={generate3DModel}
                      size="lg"
                      disabled={isGenerating3D}
                      variant="secondary"
                      className="font-bold"
                    >
                      <Box className="mr-2 h-5 w-5" />
                      {isGenerating3D ? t('result.generating3D') : t('result.generate3D')}
                    </Button>
                  </div>
                ) : (
                  <Button onClick={download3DModel} size="lg" className="font-bold">
                    <Download className="mr-2 h-5 w-5" />
                    {t('result.download3D', { format: modelFormat.toUpperCase() })}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Other Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Button
              onClick={onRestart}
              size="lg"
              variant="secondary"
              className="font-bold shadow-glow"
            >
              {t('result.retake')}
            </Button>
<Button
              onClick={handleShare}
              variant="outline"
              size="lg"
              className="font-bold"
            >
              <Share2 className="mr-2 h-5 w-5" />
              {t('result.share')}
            </Button>
          </div>
          
          {/* Personality Description */}
          <div className="bg-muted/50 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-primary mb-3">{t('result.personality')}</h3>
            <p className="text-foreground leading-relaxed mb-4">{hybrid.description}</p>
            
            {/* Detailed component breakdown */}
            {hybrid.componentBreakdown && hybrid.componentBreakdown.length > 0 && (
              <div className="mt-4 space-y-3">
                <h4 className="text-lg font-semibold text-primary">{t('result.composition')}</h4>
                {hybrid.componentBreakdown.map(component => {
                  const character = CHARACTERS[component.key];
                  const topTraits = Object.entries(character.weights)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 2)
                    .map(([trait]) => trait);
                  
                  return (
                    <div key={component.key} className="flex items-center gap-3 bg-background/50 rounded-lg p-3">
                      {character.image ? (
                        <img 
                          src={character.image} 
                          alt={character.name}
                          className="w-12 h-12 rounded-full border-2 border-primary object-contain bg-background"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center">
                          <span className="text-lg font-bold text-primary">
                            {character.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-foreground">{character.name}</span>
                          <span className="text-primary font-bold">{component.percentage}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${component.percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('result.traits')} {topTraits.join(', ')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
        </div>
      </Card>
    </div>
  );
};

export default QuizResult;
