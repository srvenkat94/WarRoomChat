import React, { useState } from 'react';
import { 
  MessageCircle, 
  Users, 
  Zap, 
  ArrowRight, 
  Lightbulb,
  Laptop,
  BookOpen,
  MapPin,
  PenTool,
  Sparkles,
  Brain,
  Shield,
  Star,
  CheckCircle,
  Layers,
  Target,
  Workflow
} from 'lucide-react';
import LoginForm from './auth/LoginForm';
import SignupForm from './auth/SignupForm';

const LandingPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(false);

  const features = [
    {
      icon: Lightbulb,
      title: "💡 Brainstorming Ideas?",
      description: "Capture every spark of creativity, and let ChatMind summarize the best ones so your ideas don't fade away.",
      color: "from-primary-400 to-primary-500",
      bgColor: "bg-primary-50",
      borderColor: "border-primary-100"
    },
    {
      icon: Laptop,
      title: "🧑‍💻 Working Remotely?",
      description: "Collaborate across time zones — ChatMind keeps context alive with summaries and shared memory blocks.",
      color: "from-cyan-400 to-cyan-500",
      bgColor: "bg-cyan-50",
      borderColor: "border-cyan-100"
    },
    {
      icon: BookOpen,
      title: "📚 Learning Together?",
      description: "Study with friends or mentors — ChatMind tracks your questions, notes, and takeaways so everyone stays on the same page.",
      color: "from-emerald-400 to-emerald-500",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-100"
    },
    {
      icon: MapPin,
      title: "🧳 Planning a Trip?",
      description: "ChatMind keeps all your itinerary ideas, bookings, and decisions organized and remembered — even when your group chat gets messy.",
      color: "from-violet-400 to-violet-500",
      bgColor: "bg-violet-50",
      borderColor: "border-violet-100"
    },
    {
      icon: PenTool,
      title: "🎓 Personal Journalling?",
      description: "Think aloud with AI, reflect, and return — ChatMind remembers your thoughts and helps you connect the dots over time.",
      color: "from-amber-400 to-amber-500",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-100"
    }
  ];

  const benefits = [
    {
      icon: Brain,
      title: "AI-Powered Memory",
      description: "Never lose track of important conversations with intelligent summaries and context preservation.",
      color: "text-primary-600"
    },
    {
      icon: Workflow,
      title: "Seamless Integration",
      description: "Works with your existing workflow and adapts to your team's collaboration style.",
      color: "text-cyan-600"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-level encryption and privacy controls keep your conversations secure.",
      color: "text-emerald-600"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-primary-50 py-16 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-5 gap-12 lg:gap-16 items-center">
              {/* Left Column - Hero Content (3/5 width) */}
              <div className="lg:col-span-3 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-8 border border-primary-200">
                  <Sparkles className="w-4 h-4" />
                  AI-Powered Team Collaboration
                </div>
                
                <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
                  Welcome to{' '}
                  <span className="text-primary-600">
                    ChatMind
                  </span>
                </h1>
                
                <p className="text-xl lg:text-2xl text-gray-600 mb-8 leading-relaxed max-w-2xl font-light">
                  A collaborative AI chatroom with shared knowledge that transforms how teams communicate and remember.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-16">
                  <button
                    onClick={() => setIsLogin(false)}
                    className="btn-primary text-lg px-8 py-4 shadow-gentle hover:shadow-md transform hover:scale-105"
                  >
                    Get started free
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </button>
                  <button
                    onClick={() => setIsLogin(true)}
                    className="btn-secondary text-lg px-8 py-4"
                  >
                    Sign in
                  </button>
                </div>

                {/* Quick Benefits */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="text-center lg:text-left">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-subtle border border-gray-200 mb-4">
                        <benefit.icon className={`w-6 h-6 ${benefit.color}`} />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2 text-lg">{benefit.title}</h3>
                      <p className="text-gray-600 leading-relaxed text-sm">{benefit.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column - Compact Auth Form (2/5 width) */}
              <div className="lg:col-span-2 relative">
                <div className="card p-8 max-w-md mx-auto shadow-gentle">
                  {isLogin ? (
                    <LoginForm onSwitchToSignup={() => setIsLogin(false)} />
                  ) : (
                    <SignupForm onSwitchToLogin={() => setIsLogin(true)} />
                  )}
                </div>
                
                {/* Subtle Decorative Elements */}
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary-100 rounded-full opacity-60 blur-xl"></div>
                <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-cyan-100 rounded-full opacity-40 blur-xl"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 lg:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16 lg:mb-20">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6 tracking-tight">
                Perfect for Every Team Need
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Whether you're brainstorming, learning, or planning, ChatMind AI adapts to your workflow and keeps your conversations organized and accessible.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="card p-8 card-hover group"
                >
                  <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-gentle`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-4 tracking-tight">
                    {feature.title}
                  </h3>
                  
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Additional Value Props */}
            <div className="mt-20 grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Layers className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Smart Organization</h3>
                <p className="text-gray-600">Automatically categorize and summarize conversations for easy retrieval and reference.</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Focused Discussions</h3>
                <p className="text-gray-600">Keep conversations on track with AI-powered context awareness and topic threading.</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Time-Saving</h3>
                <p className="text-gray-600">Reduce meeting time and email chains with persistent, searchable conversation history.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 lg:py-16 bg-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center gap-3 mb-6 md:mb-0">
                <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">C</span>
                </div>
                <span className="text-2xl font-bold">ChatMind</span>
              </div>
              
              <div className="text-gray-400 text-center md:text-right">
                <p className="text-lg">&copy; 2025 ChatMind. Intelligent collaboration for modern teams.</p>
                <p className="text-sm mt-2">Built with enterprise-grade security and privacy in mind.</p>
              </div>
            </div>
          </div>
        </footer>

        {/* Minimal Background Decoration */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-cyan-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;