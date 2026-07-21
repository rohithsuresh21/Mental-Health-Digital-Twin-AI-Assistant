import csv
import random
import math
from datetime import datetime, timedelta

random.seed(42)

# ── Healthy journal entries ──
HEALTHY_ENTRIES = [
    "Went for a morning run and felt energized throughout the day.",
    "Had a great conversation with my sister. We laughed about old memories.",
    "Finished a project at work ahead of schedule. Feeling accomplished.",
    "Cooked a new recipe tonight. It turned out better than expected.",
    "Spent the afternoon reading in the park. The weather was perfect.",
    "Called an old friend we caught up for over an hour. Felt really good.",
    "Went to the gym and hit a new personal record on my squat.",
    "Took my dog for a long walk along the river. Fresh air did wonders.",
    "Had a productive meeting at work. My ideas were well received.",
    "Started a new book before bed. Looking forward to continuing tomorrow.",
    "Made time for meditation this morning. Feeling centered and calm.",
    "Went out for brunch with friends. The food and conversation were great.",
    "Completed my weekly meal prep. Feeling organized and ready for the week.",
    "Took a different route on my commute and discovered a nice cafe.",
    "Had a really good night's sleep. Woke up before my alarm feeling rested.",
    "Finished a painting I've been working on for weeks. Proud of the result.",
    "Went to a yoga class after work. My body feels limber and relaxed.",
    "Spent the evening playing board games with my family. Lots of laughs.",
    "Got positive feedback from my manager on the quarterly review.",
    "Tried a new coffee shop downtown. The barista was friendly and the espresso was perfect.",
    "Went for a bike ride along the lake trail. The sunset was beautiful.",
    "Had a deep conversation with my partner about our future plans.",
    "Organized my closet and donated clothes I don't wear anymore.",
    "Went to the farmers market and picked up fresh produce for the week.",
    "Finished my tax return early. Glad to have that off my mind.",
    "Took a long bath with essential oils. Perfect way to unwind.",
    "Volunteered at the community center today. Helping others feels meaningful.",
    "Learned to play a new song on the guitar. Progress feels rewarding.",
    "Had a productive brainstorming session with my team at work.",
    "Went swimming at the local pool. The exercise really cleared my head.",
    "Baked cookies for my neighbors. They were thrilled with the surprise.",
    "Spent the morning journaling. It helps me process my thoughts.",
    "Had a great workout class. The instructor was motivating and supportive.",
    "Went to a comedy show downtown. Laughed so hard my cheeks hurt.",
    "Finished organizing my home office. It feels much more productive now.",
    "Had a wonderful dinner at a new restaurant downtown with my partner.",
    "Went for a hike in the mountains. The views were breathtaking.",
    "Spent the afternoon gardening. My tomatoes are finally coming in.",
    "Got a promotion at work. All the hard work is paying off.",
    "Had a relaxing evening watching the sunset from my balcony.",
    "Went to a live music event with friends. The energy was incredible.",
    "Completed a 30-day fitness challenge. Feeling strong and accomplished.",
    "Had a great therapy session. Gained some new insights about myself.",
    "Went to a art gallery opening. The work was inspiring and thought-provoking.",
    "Spent the day at the beach. The waves and sun were exactly what I needed.",
    "Had a productive day at work. Crossed everything off my to-do list.",
    "Went to a cooking class with my partner. We learned to make pasta from scratch.",
    "Finished reading a book that changed my perspective on several things.",
    "Had a wonderful morning walk through the botanical gardens.",
    "Went to a friend's housewarming party. The atmosphere was warm and welcoming.",
    "Completed my first 5K race. The sense of achievement is incredible.",
    "Had a productive conversation with my mentor about career goals.",
    "Went to a pottery class. Making something with my hands was therapeutic.",
    "Spent the evening stargazing from my rooftop. The sky was crystal clear.",
    "Had a great day at the spa. My body feels completely rejuvenated.",
    "Went to a farmers market and found organic produce at great prices.",
    "Had a meaningful conversation about mental health with a close friend.",
    "Completed a challenging puzzle over the weekend. The satisfaction was worth it.",
    "Went to a wine tasting event. Learning about different vintages was fascinating.",
    "Had a wonderful day exploring the city with my visiting parents.",
    "Finished my home renovation project. The transformation is amazing.",
    "Went for a morning swim at sunrise. The water was refreshing.",
    "Had a productive planning session for my upcoming vacation.",
    "Spent the day at a wellness retreat. Feeling completely restored.",
    "Went to a photography workshop. Learning new techniques was exciting.",
    "Had a great time at a friend's birthday celebration.",
    "Completed my first meditation retreat. The experience was transformative.",
    "Went to a farmers market and bought ingredients for a special dinner.",
    "Had a wonderful evening of board games and laughter with friends.",
    "Finished writing a short story I've been working on for months.",
    "Went to a outdoor concert in the park. The music under the stars was magical.",
    "Had a productive day organizing my digital files and photos.",
    "Went for a hike with my dog. The trail was peaceful and scenic.",
    "Had a great conversation with my neighbor about community projects.",
    "Completed a creative writing workshop. The feedback was encouraging.",
    "Went to a food festival downtown. Trying new cuisines was an adventure.",
    "Had a relaxing evening with a good book and chamomile tea.",
    "Went to a morning yoga class. Starting the day this way makes a difference.",
    "Had a productive meeting with my team about a new project.",
    "Spent the weekend camping. Disconnecting from technology was refreshing.",
    "Went to a farmer's market and found the perfect avocados.",
    "Had a wonderful day at the aquarium with my niece and nephew.",
    "Finished building a model airplane. The attention to detail was meditative.",
    "Went to a jazz club downtown. The live music was incredible.",
    "Had a great workout at the new gym that just opened nearby.",
    "Spent the afternoon at a bookstore. Found several books on my wish list.",
    "Went to a comedy open mic night. Some of the performers were hilarious.",
    "Had a productive brainstorming session for a personal project.",
    "Went for a scenic drive through the countryside. The fall colors were stunning.",
    "Had a wonderful evening cooking with my partner. We tried a new cuisine.",
    "Completed a 10K run. My training is really paying off.",
    "Went to a local theater production. The performances were outstanding.",
    "Had a great time at a friend's wedding celebration.",
    "Spent the day at a botanical garden. The flowers were in full bloom.",
    "Went to a pottery workshop. Creating something with clay was grounding.",
    "Had a productive conversation with my boss about career advancement.",
    "Went to a farmers market and bought fresh flowers for my apartment.",
    "Had a wonderful evening watching a documentary about ocean conservation.",
    "Finished my quilt project. The hand-stitching was surprisingly relaxing.",
    "Went to a community clean-up event. Making a difference felt rewarding.",
    "Had a great day at the races. The excitement of the crowd was contagious.",
    "Went to a wine and painting night with friends. My masterpiece was questionable but fun.",
    "Had a productive day working from the coffee shop. The change of scenery helped.",
    "Spent the evening learning a new language. Progress is slow but steady.",
    "Went to a farmer's market and discovered a new type of cheese.",
    "Had a wonderful morning at a meditation center. Inner peace achieved.",
    "Completed a home improvement project. The results exceeded my expectations.",
    "Went to a live podcast recording. Being in the audience was exciting.",
    "Had a great time at a food truck festival. So many delicious options.",
    "Spent the afternoon volunteering at the animal shelter.",
    "Went to a morning cycling class. The energy of the group was motivating.",
    "Had a productive day organizing my finances and investments.",
    "Went to a friend's art exhibition. The work was thought-provoking.",
    "Had a wonderful evening at a rooftop bar with city views.",
    "Finished learning to play a complete song on the piano.",
    "Went to a local brewery tour. Learning about the brewing process was interesting.",
    "Had a great time at a friend's house party. Good music and better company.",
    "Spent the day at a science museum. The exhibits were fascinating.",
    "Went to a pottery class and made my first bowl. It's imperfect but mine.",
    "Had a productive conversation with my financial advisor about retirement.",
    "Went to a farmers market and found organic honey from a local beekeeper.",
    "Had a wonderful evening at a drive-in movie theater.",
    "Completed a 30-day meditation challenge. My focus has improved significantly.",
    "Went to a local theater to see a classic play. The acting was superb.",
    "Had a great time at a friend's barbecue. The food was amazing.",
    "Spent the weekend at a cabin in the mountains. Complete tranquility.",
    "Went to a morning Pilates class. My core feels stronger already.",
    "Had a productive day at the library researching a personal project.",
    "Went to a farmer's market and bought ingredients for a special meal.",
    "Had a wonderful evening at a jazz festival in the park.",
    "Finished writing in my gratitude journal. I have so much to be thankful for.",
    "Went to a friend's graduation ceremony. I'm so proud of their accomplishment.",
    "Had a great workout at the climbing gym. My upper body is sore but happy.",
    "Spent the afternoon at a pet adoption event. So many cute animals.",
    "Went to a morning meditation session. Starting the day with intention matters.",
    "Had a productive meeting with my book club about this month's selection.",
    "Went to a farmers market and found the perfect ingredients for tonight's dinner.",
    "Had a wonderful day at a theme park with friends. We rode every roller coaster.",
    "Completed a creative writing challenge. Writing every day is becoming a habit.",
    "Went to a local art fair. The variety of talent in our community is impressive.",
    "Had a great time at a friend's engagement party. Love is in the air.",
    "Spent the evening learning to code a small game. The logic puzzles are fun.",
    "Went to a morning run club. Running with others keeps me accountable.",
    "Had a productive day decluttering my home. Less stuff, more peace.",
    "Went to a farmer's market and discovered a new type of apple. Delicious.",
    "Had a wonderful evening at a symphony performance. The music was transcendent.",
    "Finished my scrapbook of last summer's vacation. Preserving memories matters.",
    "Went to a friend's housewarming. Their new place is beautiful.",
    "Had a great time at a local trivia night with friends. We came in second.",
    "Spent the day at a lake house with family. The water was perfect for kayaking.",
    "Went to a morning spinning class. The instructor's playlist was on point.",
    "Had a productive conversation with my neighbor about starting a community garden.",
    "Went to a farmers market and bought fresh herbs for my kitchen garden.",
    "Had a wonderful evening at a comedy club. Laughing is the best medicine.",
    "Completed a home organization project. Everything has its place now.",
    "Went to a local bookstore event. Meeting the author was inspiring.",
    "Had a great time at a friend's pool party. Summer is finally here.",
    "Spent the evening learning a new recipe from a cooking show.",
    "Went to a morning stretch class. My flexibility is improving weekly.",
    "Had a productive day working on my portfolio. The progress is visible.",
    "Went to a farmer's market and found artisan bread that was still warm.",
    "Had a wonderful day at a botanical garden. The orchid exhibit was stunning.",
    "Finished reading a book that genuinely changed how I think about success.",
    "Went to a friend's milestone birthday celebration. The surprise was a hit.",
    "Had a great workout at the CrossFit box. The community there is supportive.",
    "Spent the afternoon at a jazz brunch. The music and food were both excellent.",
    "Went to a morning tai chi class in the park. The peaceful start to the day was perfect.",
    "Had a productive meeting with my team about our charity fundraiser.",
    "Went to a farmers market and found the best peaches I've ever tasted.",
    "Had a wonderful evening at a rooftop cinema. Watching a classic under the stars.",
    "Completed a week-long digital detox. My sleep has improved dramatically.",
    "Went to a local music festival. Discovering new artists is always exciting.",
    "Had a great time at a friend's camping trip. S'mores and stargazing.",
    "Spent the day at a pottery workshop. Making a mug from scratch was satisfying.",
    "Went to a morning meditation retreat. The guided session brought clarity.",
    "Had a productive conversation with my therapist about setting boundaries.",
    "Went to a farmer's market and bought organic vegetables for the week.",
    "Had a wonderful evening at a candlelight yoga session. Deeply relaxing.",
    "Finished a challenging crossword puzzle. My vocabulary has definitely improved.",
    "Went to a friend's house for a homemade pasta dinner. The effort showed.",
    "Had a great time at a local escape room with coworkers. We escaped with 2 minutes to spare.",
    "Spent the weekend at a wellness retreat. Three days of pure rejuvenation.",
    "Went to a morning dance class. Moving my body to music lifts my spirits.",
    "Had a productive day organizing my photo library. So many memories to revisit.",
    "Went to a farmers market and found a vendor selling homemade salsa. Incredible.",
    "Had a wonderful evening at a poetry reading. The words moved me deeply.",
    "Completed a 60-day fitness challenge. Consistency really is key.",
    "Went to a local theater to see a musical. The talent on stage was remarkable.",
    "Had a great time at a friend's surprise party. The look on their face was priceless.",
    "Spent the day at a nature reserve. Bird watching was surprisingly meditative.",
    "Went to a morning kickboxing class. The energy in the room was electric.",
    "Had a productive conversation with my partner about our travel plans.",
    "Went to a farmer's market and bought fresh flowers that brightened my whole apartment.",
    "Had a wonderful evening at a storytelling event. Real stories resonate deeply.",
    "Finished learning a new software tool. The learning curve was worth it.",
    "Went to a friend's art show opening. Supporting local artists feels important.",
    "Had a great workout at the new rock climbing gym. My grip strength is improving.",
    "Spent the afternoon at a community festival. The diversity of our neighborhood is beautiful.",
    "Went to a morning cycling tour of the city. Seeing familiar streets differently.",
    "Had a productive day at work. I finally cracked the problem I've been stuck on.",
    "Went to a farmers market and bought ingredients for a Mediterranean feast.",
    "Had a wonderful evening at a rooftop yoga class. Sunset and stretching.",
    "Completed my first triathlon. The training was worth every early morning.",
    "Went to a local film festival. Independent films tell stories Hollywood won't.",
    "Had a great time at a friend's book launch. Supporting their dream meant a lot.",
    "Spent the weekend at a spa resort. Total relaxation and renewal.",
    "Went to a morning breathwork session. The oxygen flow energized my whole day.",
    "Had a productive meeting about a potential collaboration with a colleague.",
    "Went to a farmer's market and found the most beautiful heirloom tomatoes.",
    "Had a wonderful evening at a jazz and wine pairing event. Sophistication.",
    "Finished my first 100-day project. Consistency builds incredible things.",
    "Went to a friend's house for a game night. Laughter really is the best medicine.",
    "Had a great time at a local food tour. Discovering hidden gem restaurants.",
    "Spent the day at a meditation center. Silent reflection brought inner peace.",
    "Went to a morning barre class. The blend of ballet and fitness is addictive.",
    "Had a productive day organizing my workspace. A clear desk helps a clear mind.",
    "Went to a farmers market and bought fresh berries for my morning smoothie.",
    "Had a wonderful evening at a candlelight concert. Classical music in that setting was magical.",
]

# ── At-risk journal entries ──
ATRISK_ENTRIES = [
    "Woke up at 3am again. Couldn't stop thinking about everything that's wrong.",
    "Cancelled all my plans today. Just couldn't face being around people.",
    "Another day where getting out of bed felt like climbing a mountain.",
    "My chest feels tight. I keep getting these waves of dread for no reason.",
    "Skipped lunch again. Food has no appeal anymore. Everything tastes like nothing.",
    "Sat in my car for 20 minutes after work before I could go inside.",
    "Had a panic attack in the grocery store. Had to leave my cart and leave.",
    "The idea of going to work tomorrow makes me want to cry. I don't know how much longer I can keep this up.",
    "Called in sick again. I'm not sick. I just can't do it today.",
    "My hands were shaking during the meeting. Nobody noticed but it terrified me.",
    "Spent the entire day in bed. The curtains are closed. I don't want to see daylight.",
    "Everything feels overwhelming. Even answering a text feels like too much effort.",
    "Had a fight with my partner over something stupid. I started it. I always start it now.",
    "The anxiety is constant. It's like a weight on my chest that never lifts.",
    "Couldn't concentrate on anything at work. Stared at my screen for hours.",
    "My sleep is destroyed. I fall asleep at 4am and wake up exhausted at 6.",
    "Went to the store and had to leave because the fluorescent lights felt unbearable.",
    "I keep replaying that conversation from last week. I said something wrong. I know I did.",
    "Lost my temper with my kids again. They didn't deserve that. I feel terrible.",
    "Haven't exercised in weeks. I used to love running. Now I can't even think about it.",
    "The intrusive thoughts are getting worse. I don't want to be alone with my mind.",
    "Spent 3 hours scrolling on my phone. I don't even remember what I was looking at.",
    "Had to leave work early. The pressure was building and I couldn't breathe.",
    "My memory is terrible lately. I forgot an important deadline. Again.",
    "I don't enjoy anything anymore. Things I used to love feel pointless.",
    "Woke up crying and I don't even know why. The sadness just comes in waves.",
    "Avoided another phone call. The thought of talking to someone makes me freeze.",
    "My appetite is all over the place. Either I can't eat or I can't stop eating.",
    "The self-doubt is paralyzing. I feel like a fraud at work and in life.",
    "Sat in the shower for an hour. The hot water was the only thing that felt good.",
    "Had a nightmare that woke me up and I couldn't go back to sleep.",
    "Everything feels far away. Like I'm watching my life from behind glass.",
    "I snapped at a coworker for something minor. I couldn't control it.",
    "Cancelled my therapy appointment. Irony isn't lost on me.",
    "The loneliness is crushing even when I'm surrounded by people.",
    "Can't stop picking at my skin. The anxiety has to go somewhere.",
    "My thoughts are racing. I can't hold onto one thought long enough to process it.",
    "Had to pull over on the drive home because I couldn't stop crying.",
    "The guilt from yesterday is eating me alive. I keep thinking about what I said.",
    "Spent the afternoon on the bathroom floor. I don't know why the floor feels safer.",
    "Woke up with a headache from clenching my jaw all night.",
    "I keep making small mistakes at work. My boss noticed. Of course they noticed.",
    "The dread before social events is getting worse. I almost cancelled again tonight.",
    "My body hurts everywhere. Stress is doing something physical to me.",
    "Couldn't finish my meal. My stomach is in knots constantly.",
    "The negative thoughts are relentless. I can't shut them off.",
    "Had a good 10 minutes today where I felt normal. Then it passed.",
    "I'm so tired of pretending I'm okay. The mask is exhausting.",
    "The rumination is the worst part. Same thoughts on repeat, all day, every day.",
    "Couldn't get out of the house today. The door felt like it weighed a thousand pounds.",
    "My heart rate spiked for no reason. Sitting still and my heart is pounding.",
    "Lost interest in the project I was passionate about. Everything feels meaningless.",
    "Had to ask my friend to repeat themselves three times. My brain couldn't process it.",
    "The irritability is off the charts. Everything and everyone is annoying me.",
    "Spent the night Googling my symptoms. Health anxiety is making everything worse.",
    "I keep comparing myself to everyone around me. I'm falling behind in everything.",
    "The fear of failure is preventing me from even starting things now.",
    "My sleep schedule is completely inverted. I'm awake when everyone else is sleeping.",
    "Had a moment where I forgot what I was saying mid-sentence. Brain fog is real.",
    "The perfectionism is destroying me. Nothing I do is ever good enough for myself.",
    "Avoided another gathering. The thought of making small talk makes me nauseous.",
    "I keep apologizing for things that aren't my fault. It's automatic now.",
    "The emotional numbness is scary. I can't feel happiness or sadness. Just nothing.",
    "My confidence is completely gone. I second-guess every decision.",
    "Had a breakdown in the bathroom at work. Pulled myself together after 10 minutes.",
    "The overthinking is constant. Every interaction gets dissected for hours.",
    "I forgot to eat today. Not intentionally. I just didn't think about food.",
    "The muscle tension in my neck and shoulders is unbearable.",
    "Had a good cry in the car. Sometimes the release is the only thing that helps.",
    "My patience is gone. I snap at the smallest things and then hate myself for it.",
    "The social battery is completely drained after a 5-minute phone call.",
    "Can't stop replaying embarrassing moments from years ago. Why now?",
    "The fatigue is bone-deep. It's not just being tired. It's exhaustion.",
    "I keep making promises to myself to do better tomorrow. Tomorrow never comes.",
    "The anxiety is louder than my own thoughts. I can't hear myself think.",
    "Had a moment of derealization today. Everything felt unreal for about an hour.",
    "My self-esteem is at rock bottom. I don't recognize the person I've become.",
    "The isolation is comfortable but I know it's not healthy. I just can't stop.",
    "Woke up with a sense of dread. No specific reason. Just dread.",
    "I keep starting and stopping medications. Nothing seems to work long enough.",
    "The brain fog is affecting my work. I'm making mistakes I never would have made before.",
    "Had to leave a party early. The noise and crowds were overwhelming.",
    "My body is keeping score. Every stress I ignore shows up as physical pain.",
    "The guilt about being unproductive is making me more unproductive. Vicious cycle.",
    "I keep looking at flights to somewhere far away. Not to travel. Just to escape.",
    "The morning anxiety is the worst. Waking up and immediately feeling overwhelmed.",
    "I can't remember the last time I felt genuinely happy. Not just pretending.",
    "The self-sabotage is real. Things start going well and I find a way to ruin it.",
    "Had a panic attack during a Zoom call. Had to blame it on internet issues.",
    "My inner critic never shuts up. It's louder than any external voice.",
    "The motivation to do anything is completely gone. I'm just going through the motions.",
    "I keep checking my phone hoping for a message that will make me feel less alone.",
    "The fear of abandonment is pushing people away. I'm creating the very thing I fear.",
    "Couldn't drive past a certain point today. Had to turn around and go home.",
    "The perfectionism is making me miss deadlines. I'd rather submit nothing than something imperfect.",
    "I cried during my commute. In traffic. With other drivers watching.",
    "The intrusive thoughts about harm are getting more frequent. They scare me.",
    "My relationship is suffering because I can't communicate what I'm feeling.",
    "The depression is making me forget things. Important things. Work things.",
    "I keep saying yes to things and then cancelling last minute. People are noticing.",
    "The morning routine that used to take 30 minutes now takes 2 hours.",
    "I'm sleeping 12+ hours a day and still exhausted. The fatigue is relentless.",
    "The derealization episodes are getting longer. I feel disconnected from my own body.",
    "I can't concentrate long enough to read a single page of a book.",
    "The physical symptoms are terrifying. Chest pain, dizziness, numbness.",
    "I keep imagining worst-case scenarios for everything. My brain won't stop catastrophizing.",
    "The emotional regulation is completely gone. I go from zero to sobbing in seconds.",
    "Had a flashback during a work meeting. Had to pretend I was fine.",
    "The avoidance is getting worse. I'm running out of things I can avoid.",
    "I'm losing weight because I forget to eat. Or I can't eat because of anxiety.",
    "The dissociation is making me feel like I'm watching my life from outside my body.",
    "I keep picking fights with people I love. It's like I want them to leave.",
    "The anxiety dreams are so vivid I wake up exhausted from sleeping.",
    "I can't make decisions anymore. Even small ones feel paralyzing.",
    "The negative self-talk is constant. I'm my own worst enemy.",
    "I had to leave the cinema because the darkness felt suffocating.",
    "The emotional flatness is scaring me. I should feel something but I don't.",
    "My hands are trembling right now as I write this. The anxiety is physical.",
    "I keep checking the locks multiple times. I know I locked them. But I check anyway.",
    "The fatigue isn't physical. It's emotional exhaustion manifesting in my body.",
    "I feel like I'm drowning in responsibilities and nobody can see it.",
    "The perfectionism is keeping me awake at night. Replaying everything I did wrong.",
    "I had a rare moment of clarity today. It lasted about 5 minutes before the fog returned.",
    "The hypervigilance is exhausting. I'm constantly scanning for threats that aren't there.",
]

# ── Combined entries (mix of healthy and at-risk with transitions) ──
COMBINED_ENTRIES = [
    # Start healthy, gradually decline
    "Had an amazing weekend. Went hiking with friends and felt truly alive.",
    "Monday back at work. Feeling a bit tired but overall good.",
    "Something felt off today. Couldn't put my finger on it.",
    "Woke up with a headache. The stress from the project is getting to me.",
    "Can't stop thinking about what my manager said in the meeting.",
    "Cancelled dinner plans. I just want to be alone tonight.",
    # Recovery attempt
    "Forced myself to go for a run. Felt better for about an hour after.",
    "Back to feeling low. The run didn't help as much as I hoped.",
    # Mixed days
    "Good morning. productive start. Then the anxiety hit around 2pm.",
    "Managed to cook dinner despite not feeling like it. Small victory.",
    "Woke up anxious but the afternoon got better. Went for coffee with a friend.",
    "The mood swings are unpredictable. Happy one hour, devastated the next.",
    # Improvement
    "Today was decent. Not great, not terrible. I'll take it.",
    "Started the day with meditation. It helped set a calmer tone.",
    "Had a panic attack at work but recovered faster than usual. Progress.",
    "Good sleep last night made a huge difference. Woke up feeling human.",
    # Setback
    "The intrusive thoughts are back. Was doing so well for a few days.",
    "Couldn't get out of bed this morning. Called in sick again.",
    "Sat in the parking lot at work for 15 minutes before going in.",
    # Recovery
    "Forced myself to socialize tonight. It was hard but I'm glad I did.",
    "Good therapy session today. Made some real breakthroughs.",
    "The anxiety is manageable today. Not gone but manageable.",
    "Exercise helped. My brain feels quieter after a good workout.",
    # Stable period
    "Another good day. Starting to feel like myself again.",
    "Went out with friends. Laughed for the first time in weeks.",
    "Sleep is improving. Falling asleep before midnight consistently.",
    "Work is going well. The panic attacks are less frequent.",
    # Trigger
    "Got some bad news today. The anxiety came flooding back.",
    "The progress I made feels erased. Back to square one.",
    "Can't stop crying. The sadness is overwhelming.",
    "Haven't slept properly in three days. The insomnia is brutal.",
    # Coping
    "Reached out to my support system today. It helped to talk.",
    "Used my coping techniques during the panic attack. They worked.",
    "Journaling is helping me process things. Writing it down takes away some of the power.",
    "Today was hard but I got through it. That counts for something.",
    # Gradual improvement
    "Feeling cautiously optimistic. The good days are starting to outnumber the bad.",
    "Went to the gym despite not wanting to. Never regret a workout.",
    "The anxiety is still there but it's not running the show anymore.",
    "Slept through the night for the first time in a week. Progress.",
    # Lapse
    "One bad day doesn't erase weeks of progress. Reminding myself of that.",
    "The negative thoughts are loud today but I'm choosing not to engage.",
    "Had to leave a meeting early but didn't spiral. That's growth.",
    "The fear is there but I'm acting despite it. Brave doesn't mean fearless.",
    # Stabilizing
    "A genuinely good day. Felt present and engaged for most of it.",
    "My therapist said I'm making real progress. I believe her today.",
    "The physical symptoms are less intense. My body is learning to calm down.",
    "Went to a social event and stayed the whole time. Felt connected.",
    # Another challenge
    "Work stress is triggering old patterns. Need to be mindful.",
    "Had a rough night but started the morning with intention. Made a difference.",
    "The rumination is trying to pull me back in. I'm resisting.",
    "Today was a survival day. Sometimes that's enough.",
    # Growing
    "I noticed the anxiety early today and intervened before it escalated.",
    "The self-compassion is getting easier. I'm learning to be kinder to myself.",
    "Set a boundary at work today. It was hard but necessary.",
    "The joy is coming back in small moments. A good cup of coffee. A sunset.",
    # Almost stable
    "I can feel the change happening. It's slow but it's real.",
    "The tools I've learned are actually working. Consistency is paying off.",
    "Had a moment of genuine happiness today. It caught me off guard.",
    "The dark days are shorter now. The light is lasting longer.",
    # New normal
    "I'm not cured but I'm managing. And that feels like enough.",
    "The anxiety is a companion now, not a captor. I can work with that.",
    "Today I felt capable. Not invincible. Just capable.",
    "I'm rebuilding. Brick by brick. Day by day.",
]

# ── Audio features generator ──
def gen_healthy_audio():
    """Healthy: normal speech, stable pitch, low pauses"""
    return {
        "speech_rate_wpm": round(random.gauss(150, 15), 1),
        "pause_ratio": round(random.gauss(0.12, 0.04), 4),
        "avg_pause_length_sec": round(random.gauss(0.45, 0.15), 4),
        "pitch_mean_hz": round(random.gauss(145 if random.random() > 0.5 else 210, 20), 1),
        "pitch_variability": round(random.gauss(25, 8), 1),
        "loudness_mean": round(random.gauss(0.06, 0.015), 4),
        "loudness_variability": round(random.gauss(0.02, 0.005), 4),
    }

def gen_atrisk_audio():
    """At-risk: slower speech, more pauses, variable pitch, lower loudness"""
    return {
        "speech_rate_wpm": round(random.gauss(110, 20), 1),
        "pause_ratio": round(random.gauss(0.28, 0.08), 4),
        "avg_pause_length_sec": round(random.gauss(1.1, 0.4), 4),
        "pitch_mean_hz": round(random.gauss(135 if random.random() > 0.5 else 195, 25), 1),
        "pitch_variability": round(random.gauss(45, 15), 1),
        "loudness_mean": round(random.gauss(0.035, 0.012), 4),
        "loudness_variability": round(random.gauss(0.035, 0.01), 4),
    }

def gen_combined_audio(healthy_weight=0.5):
    """Combined: mix of healthy and at-risk audio features"""
    if random.random() < healthy_weight:
        return gen_healthy_audio()
    return gen_atrisk_audio()


def clamp(val, lo, hi):
    return max(lo, min(hi, val))

def gen_metadata(healthiness="healthy"):
    """Generate realistic metadata for an entry"""
    base = datetime(2025, 9, 1) + timedelta(days=random.randint(0, 199))
    hour = random.choice([7, 7, 7, 8, 8, 9, 10, 12, 18, 19, 20, 21])
    minute = random.randint(0, 59)
    ts = base.replace(hour=hour, minute=minute, second=random.randint(0, 59))

    if healthiness == "healthy":
        sleep_hours = round(clamp(random.gauss(7.5, 0.8), 5.5, 9.5), 1)
        sleep_quality = round(clamp(random.gauss(0.75, 0.1), 0.4, 1.0), 2)
        activity_level = round(clamp(random.gauss(0.65, 0.12), 0.3, 1.0), 2)
        music_mood = round(clamp(random.gauss(0.6, 0.15), 0.2, 1.0), 2)
    elif healthiness == "at_risk":
        sleep_hours = round(clamp(random.gauss(5.2, 1.2), 2.0, 8.0), 1)
        sleep_quality = round(clamp(random.gauss(0.2, 0.1), 0.0, 0.5), 2)
        activity_level = round(clamp(random.gauss(0.15, 0.1), 0.0, 0.4), 2)
        music_mood = round(clamp(random.gauss(0.15, 0.1), 0.0, 0.4), 2)
    else:  # combined
        if random.random() < 0.5:
            sleep_hours = round(clamp(random.gauss(7.2, 1.0), 4.5, 9.5), 1)
            sleep_quality = round(clamp(random.gauss(0.6, 0.18), 0.15, 1.0), 2)
            activity_level = round(clamp(random.gauss(0.5, 0.2), 0.1, 1.0), 2)
            music_mood = round(clamp(random.gauss(0.5, 0.2), 0.1, 1.0), 2)
        else:
            sleep_hours = round(clamp(random.gauss(5.5, 1.5), 2.0, 8.0), 1)
            sleep_quality = round(clamp(random.gauss(0.25, 0.12), 0.0, 0.5), 2)
            activity_level = round(clamp(random.gauss(0.2, 0.12), 0.0, 0.45), 2)
            music_mood = round(clamp(random.gauss(0.2, 0.12), 0.0, 0.45), 2)

    return ts, sleep_hours, sleep_quality, activity_level, music_mood


def write_text_csv(entries, healthiness, filename):
    rows = []
    for text in entries:
        ts, sh, sq, al, mm = gen_metadata(healthiness)
        rows.append({
            "text": text,
            "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
            "sleep_hours": sh,
            "sleep_quality": sq,
            "activity_level": al,
            "music_mood_score": mm,
        })
    with open(filename, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["text", "timestamp", "sleep_hours", "sleep_quality", "activity_level", "music_mood_score"])
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows to {filename}")


def write_audio_csv(entries, healthiness, filename, audio_gen_fn):
    rows = []
    for i, text in enumerate(entries):
        features = audio_gen_fn()
        rows.append({
            "entry_id": i + 1,
            "category": healthiness,
            "speech_rate_wpm": features["speech_rate_wpm"],
            "pause_ratio": features["pause_ratio"],
            "avg_pause_length_sec": features["avg_pause_length_sec"],
            "pitch_mean_hz": features["pitch_mean_hz"],
            "pitch_variability": features["pitch_variability"],
            "loudness_mean": features["loudness_mean"],
            "loudness_variability": features["loudness_variability"],
            "text_snippet": text[:80].replace('"', "'"),
        })
    with open(filename, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["entry_id", "category", "speech_rate_wpm", "pause_ratio",
                                           "avg_pause_length_sec", "pitch_mean_hz", "pitch_variability",
                                           "loudness_mean", "loudness_variability", "text_snippet"])
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows to {filename}")


if __name__ == "__main__":
    import os
    os.chdir(r"E:\Mental-Health-Digital-Twin-AI\data")

    # Text CSVs
    write_text_csv(HEALTHY_ENTRIES[:200], "healthy", "healthy_dataset_200.csv")
    write_text_csv(ATRISK_ENTRIES[:200], "at_risk", "at_risk_dataset_200.csv")

    # Combined: pick 100 healthy + 100 at-risk, shuffle
    combined = []
    for t in HEALTHY_ENTRIES[:100]:
        combined.append(("healthy", t))
    for t in ATRISK_ENTRIES[:100]:
        combined.append(("at_risk", t))
    random.shuffle(combined)
    combined_texts = [t for _, t in combined]
    write_text_csv(combined_texts, "combined", "combination_dataset_200.csv")

    # Audio CSVs
    write_audio_csv(HEALTHY_ENTRIES[:200], "healthy", "audio_healthy_200.csv", gen_healthy_audio)
    write_audio_csv(ATRISK_ENTRIES[:200], "at_risk", "audio_at_risk_200.csv", gen_atrisk_audio)

    # Combined audio: mix with realistic ratio
    audio_combined = []
    for i, t in enumerate(HEALTHY_ENTRIES[:100]):
        audio_combined.append(("healthy", t))
    for i, t in enumerate(ATRISK_ENTRIES[:100]):
        audio_combined.append(("at_risk", t))
    random.shuffle(audio_combined)
    rows = []
    for idx, (cat, text) in enumerate(audio_combined):
        features = gen_healthy_audio() if cat == "healthy" else gen_atrisk_audio()
        rows.append({
            "entry_id": idx + 1,
            "category": cat,
            "speech_rate_wpm": features["speech_rate_wpm"],
            "pause_ratio": features["pause_ratio"],
            "avg_pause_length_sec": features["avg_pause_length_sec"],
            "pitch_mean_hz": features["pitch_mean_hz"],
            "pitch_variability": features["pitch_variability"],
            "loudness_mean": features["loudness_mean"],
            "loudness_variability": features["loudness_variability"],
            "text_snippet": text[:80].replace('"', "'"),
        })
    with open("audio_combined_200.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["entry_id", "category", "speech_rate_wpm", "pause_ratio",
                                           "avg_pause_length_sec", "pitch_mean_hz", "pitch_variability",
                                           "loudness_mean", "loudness_variability", "text_snippet"])
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows to audio_combined_200.csv")

    print("\nAll datasets generated successfully!")
