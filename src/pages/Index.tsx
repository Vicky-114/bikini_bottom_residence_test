import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import { QuizQuestion as QuizQuestionType, Answer, TraitScores, HybridCharacter } from '@/types/quiz';
import { computeMatch, createHybridCharacter, saveHybrid } from '@/utils/quizLogic';
import WelcomeScreen from '@/components/WelcomeScreen';
import QuizQuestion from '@/components/QuizQuestion';
import QuizResult from '@/components/QuizResult';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const Index = () => {
  const [userName, setUserName] = useState<string>('');
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestionType | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [traitScores, setTraitScores] = useState<TraitScores>({});
  const [isLoading, setIsLoading] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [currentHybrid, setCurrentHybrid] = useState<HybridCharacter | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleStart = (name: string) => {
    setUserName(name);
    setQuizStarted(true);
    // Start quiz with first question
    generateQuestion('initial');
  };

  const generateQuestion = async (type: 'initial' | 'adaptive') => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase is not configured for this deployment');
      }

      const askedQuestions = answers.map(a => a.questionText);
      const { data, error } = await supabase.functions.invoke('generate-quiz-question', {
        body: {
          type,
          previousAnswers: type === 'adaptive' ? answers : undefined,
          askedQuestions: askedQuestions,
        },
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      console.log('Received question data:', data);

      setCurrentQuestion({
        id: `q${questionNumber}`,
        text: data.question,
        options: data.options,
      });
    } catch (error) {
      console.error('Error generating question:', error);
      
      // Use a fallback question if AI fails
      const fallbackQuestions = [
        {
          question: "What's your ideal way to spend a Saturday?",
          options: [
            {label:"Working on a fun project", traits:{industrious:2, inventive:1}},
            {label:"Relaxing at home", traits:{relaxed:2, calm:1}},
            {label:"Hanging out with friends", traits:{social:2, loyal:1}},
            {label:"Pursuing a hobby", traits:{artistic:2, playful:1}}
          ]
        },
        {
          question: "How do you handle stress?",
          options: [
            {label:"Stay calm and think it through", traits:{calm:2, analytical:1}},
            {label:"Keep a positive attitude", traits:{optimistic:2, brave:1}},
            {label:"Talk to friends", traits:{social:2, loyal:1}},
            {label:"Worry about everything", traits:{anxious:2, cautious:1}}
          ]
        },
        {
          question: "What's most important to you?",
          options: [
            {label:"Having fun and laughing", traits:{playful:2, optimistic:1}},
            {label:"Being successful", traits:{ambitious:2, industrious:1}},
            {label:"Helping others", traits:{loyal:2, responsible:1}},
            {label:"Being creative", traits:{artistic:2, inventive:1}}
          ]
        }
      ];
      
      const fallback = fallbackQuestions[questionNumber - 1] || fallbackQuestions[0];
      
      setCurrentQuestion({
        id: `q${questionNumber}`,
        text: fallback.question,
        options: fallback.options,
      });
      
      toast({
        title: t('common.fallbackTitle'),
        description: isSupabaseConfigured
          ? t('common.fallbackDescription')
          : 'This published version is using local fallback questions because AI services are not configured.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = async (label: string, traits: TraitScores) => {
    if (!currentQuestion) return;

    // Record answer
    const newAnswer: Answer = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.text,
      answerLabel: label,
      traits,
    };

    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);

    // Update trait scores
    const newTraitScores = { ...traitScores };
    for (const [trait, score] of Object.entries(traits)) {
      newTraitScores[trait] = (newTraitScores[trait] || 0) + score;
    }
    setTraitScores(newTraitScores);

    // Check if we should end the quiz
    const matchResult = computeMatch(newTraitScores);
    const minQuestions = 8; // Minimum questions before ending
    const maxQuestions = 10; // Maximum questions to keep quiz short
    
    console.log(`Question ${questionNumber} answered. Current confidence: ${(matchResult.topMatch.confidence * 100).toFixed(1)}%`);
    console.log('Top match:', matchResult.topMatch.name);
    console.log(`Questions: ${questionNumber}/${maxQuestions} (min: ${minQuestions})`);
    
    // End quiz if: reached max questions OR (high confidence AND at least min questions)
    const shouldEnd = questionNumber >= maxQuestions || 
                      (matchResult.topMatch.confidence >= 0.85 && questionNumber >= minQuestions);
    
    if (shouldEnd) {
      console.log(`✓ Quiz complete! ${(matchResult.topMatch.confidence * 100).toFixed(1)}% confidence after ${questionNumber} questions`);
      
      // Create hybrid character with user's name
      const hybrid = createHybridCharacter(newTraitScores, newAnswers, userName);
      setCurrentHybrid(hybrid);
      setQuizComplete(true);
      
      toast({
        title: t('quiz.completeTitle'),
        description: t('quiz.completeDescription', { number: questionNumber }),
      });
    } else {
      // Generate next question (adaptive)
      console.log(`→ Generating question ${questionNumber + 1}/${maxQuestions}`);
      setQuestionNumber(prev => prev + 1);
      generateQuestion('adaptive');
    }
  };

  // Callback when hybrid image is generated
  const handleImageGenerated = (imageUrl: string) => {
    if (currentHybrid) {
      const updatedHybrid = { ...currentHybrid, generatedImageUrl: imageUrl };
      setCurrentHybrid(updatedHybrid);
      
      // Save to localStorage
      saveHybrid(updatedHybrid);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(null);
    setQuestionNumber(1);
    setAnswers([]);
    setTraitScores({});
    setQuizComplete(false);
    setCurrentHybrid(null);
    setQuizStarted(false);
    setUserName('');
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* World button - top right */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <LanguageSwitcher />
      </div>

      {/* Quiz content */}
      {!quizStarted && (
        <WelcomeScreen onStart={handleStart} />
      )}

      {quizStarted && isLoading && (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
          <p className="text-xl text-foreground">{t('common.generating')}</p>
        </div>
      )}

      {quizStarted && !isLoading && !quizComplete && currentQuestion && (
        <QuizQuestion
          question={currentQuestion}
          onAnswer={handleAnswer}
          questionNumber={questionNumber}
        />
      )}

      {quizComplete && currentHybrid && (
        <QuizResult
          hybrid={currentHybrid}
          onRestart={handleRestart}
          onImageGenerated={handleImageGenerated}
        />
      )}
    </div>
  );
};

export default Index;
