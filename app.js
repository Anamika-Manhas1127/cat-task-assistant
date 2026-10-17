(() => {
  "use strict";
  const STORAGE_KEY = "cat-task-assistant-v1";
  const LANG_KEY = "cat-task-assistant-language";
  const translations = {
    en: {
      workspace:"WORKSPACE",today:"Today",history:"Task history",littleReminder:"A little reminder…",progressNotPerfection:"Progress, not purrfection.",oneThing:"One small thing at a time. ♡",yourBuddy:"Your cat buddy",hereToHelp:"Here to help, not judge.",language:"Language",littleSteps:"A LITTLE PAW-SITIVITY GOES A LONG WAY",hello:"Hello, sunshine",welcomeSub:"Let's make today feel a little lighter, one task at a time.",note:"You don't have to do it all. Just start with one.",youGotThis:"you've got this!",tasksLeft:"Tasks left",completed:"Completed",dailyProgress:"Daily progress",yourDay:"YOUR DAY, YOUR PACE",todaysTasks:"Today's tasks",gentleNudge:"Little wins count, too.",addTask:"Add task",allTasks:"All tasks",toDo:"To do",doneFilter:"Done",newMission:"A NEW LITTLE MISSION",makeItHappen:"Make it happen!",addTaskSub:"Give your future self a tiny favour.",taskName:"Task name",taskPlaceholder:"e.g. Review Java notes",category:"Category",study:"Study time",water:"Drink water",exercise:"Exercise",laundry:"Laundry",other:"A little something",dueTime:"Due time",saveTask:"Save this task",kindReminder:"Kindness to yourself is productive, too.",quote:"“Even the tiniest paw steps take you somewhere lovely.”",quoteBy:"— your cat buddy",littleWins:"LOOK HOW FAR YOU'VE COME",taskHistoryTitle:"Task history",historySub:"Every attempt counts. Every restart counts.",backToToday:"Back to today",allCaughtUp:"You're all caught up!",emptyHint:"Add a little task and your cat buddy will cheer you on.",addFirstTask:"Add your first task",historyEmpty:"Your story starts here.",historyEmptySub:"Completed, skipped and snoozed tasks will show up here.",footerNote:"Small steps. Soft paws. Big dreams.",chatTitle:"Chat with your cat",catHere:"Your buddy is here",catGreeting:"Mrrp! Ready to make today a little brighter? Tell me what's on your mind. ♡",placeholderNotice:"Just a friendly placeholder for now — AI isn't connected yet.",motivateMe:"Cheer me on ✨",takeBreak:"I need a break ☁",focusTip:"Help me focus ♡",chatPlaceholder:"Say something to your cat…",due:"Due",noDue:"No due time",done:"Done",snoozed:"Snoozed 10 min",skipped:"Skipped",pending:"To do",doneButton:"Done",snoozeButton:"Snooze 10 min",skipButton:"Skip",deleteButton:"Remove",created:"Added",historyDone:"Completed",historySnoozed:"Snoozed",historySkipped:"Skipped",taskAdded:"Task added. Tiny steps, big magic!",taskCompleted:"Paw-some work! One more little win. ♡",taskSnoozed:"No worries. I'll nudge this task 10 minutes later. ⏰",taskSkipped:"It's okay to reprioritize. This task is marked skipped.",taskRemoved:"Task removed. Fresh start!",catMotivate:"You're doing better than you think. Pick one tiny step, take a breath, and let that be enough for now. ♡",catBreak:"A little pause is productive too. Stretch your shoulders, sip some water, and come back when you're ready. ☁",catFocus:"Try a tiny focus sprint: choose one task, set a 10-minute timer, and ignore everything else until it rings. You've got this! ✨",catDefault:"Mrrp! I'm your cozy productivity buddy. I can cheer you on, but my AI brain isn't connected just yet. ♡",you:"You",cat:"Cat buddy",confirmRemove:"Remove this task?",dateToday:"Today",dateYesterday:"Yesterday",noHistory:"No task history yet.",status:"Status",categoryNames:{study:"Study time",water:"Drink water",exercise:"Exercise",laundry:"Laundry",other:"A little something"}
    },
    hi: {
      workspace:"कार्यस्थान",today:"आज",history:"कार्य इतिहास",littleReminder:"एक प्यारी याद दिलाहट…",progressNotPerfection:"प्रगति ज़रूरी है, पूर्णता नहीं।",oneThing:"एक समय में एक छोटा कदम। ♡",yourBuddy:"आपकी बिल्ली दोस्त",hereToHelp:"मदद के लिए, जज करने नहीं।",language:"भाषा",littleSteps:"छोटे कदम भी बहुत आगे ले जाते हैं",hello:"नमस्ते, चमकते सितारे",welcomeSub:"आइए, एक-एक काम करके आज को थोड़ा आसान बनाएँ।",note:"सब कुछ करना ज़रूरी नहीं। बस एक काम से शुरू करें।",youGotThis:"आप कर सकते हैं!",tasksLeft:"बाकी काम",completed:"पूरे हुए",dailyProgress:"आज की प्रगति",yourDay:"आपका दिन, आपकी रफ़्तार",todaysTasks:"आज के काम",gentleNudge:"छोटी जीत भी मायने रखती है।",addTask:"काम जोड़ें",allTasks:"सभी काम",toDo:"करने हैं",doneFilter:"पूरे हुए",newMission:"एक नया छोटा मिशन",makeItHappen:"चलो, कर दिखाएँ!",addTaskSub:"अपने आने वाले कल के लिए एक छोटा उपहार।",taskName:"काम का नाम",taskPlaceholder:"जैसे, Java के नोट्स दोहराएँ",category:"श्रेणी",study:"पढ़ाई",water:"पानी पिएँ",exercise:"व्यायाम",laundry:"कपड़े धोना",other:"कुछ और",dueTime:"समय",saveTask:"काम सेव करें",kindReminder:"खुद के प्रति दयालु होना भी उत्पादकता है।",quote:"“छोटे-छोटे कदम भी खूबसूरत जगहों तक ले जाते हैं।”",quoteBy:"— आपकी बिल्ली दोस्त",littleWins:"देखिए, आपने कितना सफ़र तय किया",taskHistoryTitle:"कार्य इतिहास",historySub:"हर कोशिश मायने रखती है। फिर से शुरू करना भी।",backToToday:"आज पर लौटें",allCaughtUp:"आपके सभी काम पूरे हैं!",emptyHint:"एक छोटा काम जोड़ें, आपकी बिल्ली दोस्त आपका हौसला बढ़ाएगी।",addFirstTask:"पहला काम जोड़ें",historyEmpty:"आपकी कहानी यहाँ से शुरू होती है।",historyEmptySub:"पूरे, छोड़े और बाद के लिए रखे गए काम यहाँ दिखेंगे।",footerNote:"छोटे कदम। नरम पंजे। बड़े सपने।",chatTitle:"अपनी बिल्ली से बात करें",catHere:"आपकी दोस्त यहाँ है",catGreeting:"म्याऊँ! आज को थोड़ा बेहतर बनाएँ? बताइए, मन में क्या है। ♡",placeholderNotice:"अभी यह दोस्ताना डेमो है — AI अभी जुड़ा नहीं है।",motivateMe:"मेरा हौसला बढ़ाओ ✨",takeBreak:"मुझे आराम चाहिए ☁",focusTip:"ध्यान लगाने में मदद ♡",chatPlaceholder:"अपनी बिल्ली से कुछ कहें…",due:"समय",noDue:"समय तय नहीं",done:"पूरा",snoozed:"10 मिनट बाद",skipped:"छोड़ा गया",pending:"बाकी",doneButton:"हो गया",snoozeButton:"10 मिनट बाद",skipButton:"छोड़ें",deleteButton:"हटाएँ",created:"जोड़ा गया",historyDone:"पूरा किया",historySnoozed:"बाद के लिए रखा",historySkipped:"छोड़ा",taskAdded:"काम जुड़ गया। छोटे कदम, बड़ी खुशी!",taskCompleted:"शाबाश! एक और छोटी जीत। ♡",taskSnoozed:"कोई बात नहीं। 10 मिनट बाद फिर याद दिलाएँगे। ⏰",taskSkipped:"प्राथमिकता बदलना ठीक है। यह काम छोड़ दिया गया है।",taskRemoved:"काम हट गया। नई शुरुआत!",catMotivate:"आप जितना सोचते हैं, उससे बेहतर कर रहे हैं। एक छोटा कदम चुनें, साँस लें, अभी के लिए इतना काफ़ी है। ♡",catBreak:"थोड़ा रुकना भी उत्पादक है। कंधे फैलाएँ, पानी पिएँ और तैयार होने पर लौटें। ☁",catFocus:"छोटा फोकस सत्र आज़माएँ: एक काम चुनें, 10 मिनट का टाइमर लगाएँ और तब तक उसी पर ध्यान दें। ✨",catDefault:"म्याऊँ! मैं आपकी प्यारी productivity दोस्त हूँ। हौसला बढ़ा सकती हूँ, पर मेरा AI अभी जुड़ा नहीं है। ♡",you:"आप",cat:"बिल्ली दोस्त",confirmRemove:"यह काम हटाएँ?",dateToday:"आज",dateYesterday:"कल",noHistory:"अभी कोई कार्य इतिहास नहीं।",status:"स्थिति",categoryNames:{study:"पढ़ाई",water:"पानी पिएँ",exercise:"व्यायाम",laundry:"कपड़े धोना",other:"कुछ और"}
    },
    kn: {
      workspace:"ಕಾರ್ಯಸ್ಥಳ",today:"ಇಂದು",history:"ಕಾರ್ಯ ಇತಿಹಾಸ",littleReminder:"ಒಂದು ಸಣ್ಣ ನೆನಪು…",progressNotPerfection:"ಪರಿಪೂರ್ಣತೆಯಲ್ಲ, ಪ್ರಗತಿ ಮುಖ್ಯ.",oneThing:"ಒಂದು ಸಮಯದಲ್ಲಿ ಒಂದು ಸಣ್ಣ ಹೆಜ್ಜೆ. ♡",yourBuddy:"ನಿಮ್ಮ ಬೆಕ್ಕಿನ ಸ್ನೇಹಿತ",hereToHelp:"ಸಹಾಯ ಮಾಡಲು ಇಲ್ಲಿದೆ.",language:"ಭಾಷೆ",littleSteps:"ಸಣ್ಣ ಹೆಜ್ಜೆಗಳೂ ದೂರ ಕರೆದೊಯ್ಯುತ್ತವೆ",hello:"ನಮಸ್ಕಾರ, ಮುದ್ದಿನ ಸೂರ್ಯಕಿರಣ",welcomeSub:"ಒಂದು ಕೆಲಸದಂತೆ ಮಾಡಿ, ಇಂದಿನ ದಿನವನ್ನು ಸುಲಭವಾಗಿಸೋಣ.",note:"ಎಲ್ಲವನ್ನೂ ಮಾಡಬೇಕಿಲ್ಲ. ಒಂದರಿಂದ ಪ್ರಾರಂಭಿಸಿ.",youGotThis:"ನಿಮಗೆ ಸಾಧ್ಯ!",tasksLeft:"ಬಾಕಿ ಕೆಲಸಗಳು",completed:"ಪೂರ್ಣಗೊಂಡವು",dailyProgress:"ದಿನದ ಪ್ರಗತಿ",yourDay:"ನಿಮ್ಮ ದಿನ, ನಿಮ್ಮ ವೇಗ",todaysTasks:"ಇಂದಿನ ಕೆಲಸಗಳು",gentleNudge:"ಸಣ್ಣ ಗೆಲುವೂ ಮುಖ್ಯ.",addTask:"ಕೆಲಸ ಸೇರಿಸಿ",allTasks:"ಎಲ್ಲಾ ಕೆಲಸಗಳು",toDo:"ಮಾಡಬೇಕಾದವು",doneFilter:"ಪೂರ್ಣ",newMission:"ಒಂದು ಹೊಸ ಸಣ್ಣ ಕಾರ್ಯ",makeItHappen:"ಮಾಡೋಣ!",addTaskSub:"ಭವಿಷ್ಯದ ನಿಮಗಾಗಿ ಒಂದು ಸಣ್ಣ ಉಡುಗೊರೆ.",taskName:"ಕೆಲಸದ ಹೆಸರು",taskPlaceholder:"ಉದಾ: Java ಟಿಪ್ಪಣಿಗಳನ್ನು ಓದಿ",category:"ವರ್ಗ",study:"ಅಧ್ಯಯನ",water:"ನೀರು ಕುಡಿಯಿರಿ",exercise:"ವ್ಯಾಯಾಮ",laundry:"ಬಟ್ಟೆ ಒಗೆಯುವುದು",other:"ಇನ್ನೊಂದು ಕೆಲಸ",dueTime:"ಸಮಯ",saveTask:"ಕೆಲಸ ಉಳಿಸಿ",kindReminder:"ನಿಮ್ಮ ಬಗ್ಗೆ ಕಾಳಜಿ ವಹಿಸುವುದೂ ಪ್ರಗತಿಯೇ.",quote:"“ಸಣ್ಣ ಹೆಜ್ಜೆಗಳೂ ಸುಂದರ ಸ್ಥಳಗಳಿಗೆ ಕರೆದೊಯ್ಯುತ್ತವೆ.”",quoteBy:"— ನಿಮ್ಮ ಬೆಕ್ಕಿನ ಸ್ನೇಹಿತ",littleWins:"ನೀವು ಎಷ್ಟು ಮುಂದೆ ಬಂದಿದ್ದೀರಿ ನೋಡಿ",taskHistoryTitle:"ಕಾರ್ಯ ಇತಿಹಾಸ",historySub:"ಪ್ರತಿ ಪ್ರಯತ್ನವೂ ಮುಖ್ಯ. ಮತ್ತೆ ಆರಂಭಿಸುವುದೂ ಮುಖ್ಯ.",backToToday:"ಇಂದಿಗೆ ಹಿಂತಿರುಗಿ",allCaughtUp:"ಎಲ್ಲಾ ಕೆಲಸ ಮುಗಿದಿವೆ!",emptyHint:"ಒಂದು ಕೆಲಸ ಸೇರಿಸಿ, ನಿಮ್ಮ ಬೆಕ್ಕಿನ ಸ್ನೇಹಿತ ಹುರಿದುಂಬಿಸುತ್ತದೆ.",addFirstTask:"ಮೊದಲ ಕೆಲಸ ಸೇರಿಸಿ",historyEmpty:"ನಿಮ್ಮ ಕಥೆ ಇಲ್ಲಿಂದ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ.",historyEmptySub:"ಪೂರ್ಣಗೊಂಡ, ಬಿಟ್ಟ ಮತ್ತು ಮುಂದೂಡಿದ ಕೆಲಸಗಳು ಇಲ್ಲಿ ಕಾಣುತ್ತವೆ.",footerNote:"ಸಣ್ಣ ಹೆಜ್ಜೆಗಳು. ಮೃದು ಪಂಜಗಳು. ದೊಡ್ಡ ಕನಸುಗಳು.",chatTitle:"ನಿಮ್ಮ ಬೆಕ್ಕಿನೊಂದಿಗೆ ಮಾತಾಡಿ",catHere:"ನಿಮ್ಮ ಸ್ನೇಹಿತ ಇಲ್ಲಿದೆ",catGreeting:"ಮಿಯಾಂವ್! ಇಂದನ್ನು ಇನ್ನಷ್ಟು ಚೆನ್ನಾಗಿಸೋಣವೇ? ನಿಮ್ಮ ಮನಸ್ಸಿನ ಮಾತು ಹೇಳಿ. ♡",placeholderNotice:"ಇದು ಈಗ ಸ್ನೇಹಪೂರ್ಣ ಮಾದರಿ ಮಾತ್ರ — AI ಇನ್ನೂ ಸಂಪರ್ಕಗೊಂಡಿಲ್ಲ.",motivateMe:"ಹುರಿದುಂಬಿಸು ✨",takeBreak:"ಸ್ವಲ್ಪ ವಿರಾಮ ಬೇಕು ☁",focusTip:"ಗಮನ ಕೇಂದ್ರೀಕರಿಸಲು ಸಹಾಯ ♡",chatPlaceholder:"ನಿಮ್ಮ ಬೆಕ್ಕಿಗೆ ಏನಾದರೂ ಹೇಳಿ…",due:"ಸಮಯ",noDue:"ಸಮಯವಿಲ್ಲ",done:"ಪೂರ್ಣ",snoozed:"10 ನಿಮಿಷ ಮುಂದೂಡಲಾಗಿದೆ",skipped:"ಬಿಡಲಾಗಿದೆ",pending:"ಬಾಕಿ",doneButton:"ಆಯಿತು",snoozeButton:"10 ನಿಮಿಷ ಮುಂದೂಡಿ",skipButton:"ಬಿಡಿ",deleteButton:"ತೆಗೆದುಹಾಕಿ",created:"ಸೇರಿಸಲಾಗಿದೆ",historyDone:"ಪೂರ್ಣಗೊಂಡಿದೆ",historySnoozed:"ಮುಂದೂಡಲಾಗಿದೆ",historySkipped:"ಬಿಡಲಾಗಿದೆ",taskAdded:"ಕೆಲಸ ಸೇರಿಸಲಾಗಿದೆ. ಸಣ್ಣ ಹೆಜ್ಜೆ, ದೊಡ್ಡ ಸಂತೋಷ!",taskCompleted:"ಅದ್ಭುತ! ಇನ್ನೊಂದು ಸಣ್ಣ ಗೆಲುವು. ♡",taskSnoozed:"ಪರವಾಗಿಲ್ಲ. 10 ನಿಮಿಷಗಳ ನಂತರ ನೆನಪಿಸುತ್ತೇನೆ. ⏰",taskSkipped:"ಆದ್ಯತೆ ಬದಲಿಸುವುದು ಸರಿ. ಈ ಕೆಲಸವನ್ನು ಬಿಟ್ಟಿದ್ದೇವೆ.",taskRemoved:"ಕೆಲಸ ತೆಗೆದುಹಾಕಲಾಗಿದೆ. ಹೊಸ ಆರಂಭ!",catMotivate:"ನೀವು ಭಾವಿಸುವುದಕ್ಕಿಂತ ಚೆನ್ನಾಗಿ ಮಾಡುತ್ತಿದ್ದೀರಿ. ಒಂದು ಸಣ್ಣ ಹೆಜ್ಜೆ ಇಡಿ, ಉಸಿರಾಡಿ — ಈಗ ಅಷ್ಟೇ ಸಾಕು. ♡",catBreak:"ಸಣ್ಣ ವಿರಾಮವೂ ಉಪಯುಕ್ತ. ಭುಜಗಳನ್ನು ಹಿಗ್ಗಿಸಿ, ನೀರು ಕುಡಿಯಿರಿ, ಸಿದ್ಧವಾದಾಗ ಮರಳಿ ಬನ್ನಿ. ☁",catFocus:"ಸಣ್ಣ ಗಮನ ಸಮಯ ಪ್ರಯತ್ನಿಸಿ: ಒಂದು ಕೆಲಸ ಆಯ್ಕೆ ಮಾಡಿ, 10 ನಿಮಿಷದ ಟೈಮರ್ ಇಡಿ, ಅದೊಂದರ ಮೇಲೆಯೇ ಗಮನ ಕೊಡಿ. ✨",catDefault:"ಮಿಯಾಂವ್! ನಾನು ನಿಮ್ಮ ಸ್ನೇಹಪೂರ್ಣ ಕೆಲಸದ ಗೆಳೆಯ. ಹುರಿದುಂಬಿಸಬಲ್ಲೆ, ಆದರೆ AI ಇನ್ನೂ ಸಂಪರ್ಕಗೊಂಡಿಲ್ಲ. ♡",you:"ನೀವು",cat:"ಬೆಕ್ಕಿನ ಸ್ನೇಹಿತ",confirmRemove:"ಈ ಕೆಲಸವನ್ನು ತೆಗೆದುಹಾಕಬೇಕೆ?",dateToday:"ಇಂದು",dateYesterday:"ನಿನ್ನೆ",noHistory:"ಇನ್ನೂ ಕಾರ್ಯ ಇತಿಹಾಸವಿಲ್ಲ.",status:"ಸ್ಥಿತಿ",categoryNames:{study:"ಅಧ್ಯಯನ",water:"ನೀರು ಕುಡಿಯಿರಿ",exercise:"ವ್ಯಾಯಾಮ",laundry:"ಬಟ್ಟೆ ಒಗೆಯುವುದು",other:"ಇನ್ನೊಂದು ಕೆಲಸ"}
    },
    ja: {
      workspace:"ワークスペース",today:"今日",history:"タスク履歴",littleReminder:"小さなお知らせ…",progressNotPerfection:"完璧より、一歩ずつ。",oneThing:"ひとつずつ、ゆっくり。♡",yourBuddy:"ねこの相棒",hereToHelp:"ジャッジせず、お手伝い。",language:"言語",littleSteps:"小さな一歩が大きな力に",hello:"こんにちは、すてきなあなた",welcomeSub:"タスクをひとつずつ、今日を少し軽やかに。",note:"全部やらなくて大丈夫。まずひとつから。",youGotThis:"きっとできるよ！",tasksLeft:"残りのタスク",completed:"完了",dailyProgress:"今日の進捗",yourDay:"あなたの一日、あなたのペース",todaysTasks:"今日のタスク",gentleNudge:"小さな成功も大切。",addTask:"タスクを追加",allTasks:"すべて",toDo:"未完了",doneFilter:"完了",newMission:"小さなミッション",makeItHappen:"やってみよう！",addTaskSub:"未来の自分に小さな贈りもの。",taskName:"タスク名",taskPlaceholder:"例：Javaのノートを復習",category:"カテゴリー",study:"勉強",water:"水を飲む",exercise:"運動",laundry:"洗濯",other:"そのほか",dueTime:"時間",saveTask:"タスクを保存",kindReminder:"自分に優しくすることも大切。",quote:"「小さな足あとも、すてきな場所へつながるよ。」",quoteBy:"— ねこの相棒",littleWins:"ここまでよく頑張ったね",taskHistoryTitle:"タスク履歴",historySub:"挑戦も、やり直しも、すべて大切。",backToToday:"今日に戻る",allCaughtUp:"タスクはすべて完了！",emptyHint:"タスクを追加して、ねこの相棒に応援してもらおう。",addFirstTask:"最初のタスクを追加",historyEmpty:"ここからあなたの物語が始まるよ。",historyEmptySub:"完了・スキップ・スヌーズしたタスクが表示されます。",footerNote:"小さな一歩。やさしい肉球。大きな夢。",chatTitle:"ねことおしゃべり",catHere:"相棒がここにいるよ",catGreeting:"にゃー！今日をもっと素敵にしよう。何でも聞かせてね。♡",placeholderNotice:"今はデモ用メッセージです — AIはまだ接続されていません。",motivateMe:"応援して！ ✨",takeBreak:"休憩したい ☁",focusTip:"集中のコツ ♡",chatPlaceholder:"ねこに話しかけてね…",due:"予定",noDue:"時間未設定",done:"完了",snoozed:"10分後に再通知",skipped:"スキップ",pending:"未完了",doneButton:"完了",snoozeButton:"10分スヌーズ",skipButton:"スキップ",deleteButton:"削除",created:"追加",historyDone:"完了",historySnoozed:"スヌーズ",historySkipped:"スキップ",taskAdded:"タスクを追加したよ。小さな一歩、大きな喜び！",taskCompleted:"にゃんと素晴らしい！小さな成功がひとつ増えたね。♡",taskSnoozed:"大丈夫。10分後にもう一度お知らせするね。⏰",taskSkipped:"優先順位を変えても大丈夫。このタスクはスキップにしたよ。",taskRemoved:"タスクを削除したよ。新しいスタート！",catMotivate:"思っているよりずっと頑張っているよ。小さな一歩を選んで、深呼吸。それだけで十分。♡",catBreak:"休憩も大切だよ。肩を伸ばして水を飲んで、準備ができたら戻っておいで。☁",catFocus:"10分だけ集中してみよう。タスクをひとつ選んでタイマーをセット。その間はひとつだけに集中！✨",catDefault:"にゃー！私はあなたのやさしいタスク相棒。応援はできるけど、AIはまだ接続されていないよ。♡",you:"あなた",cat:"ねこの相棒",confirmRemove:"このタスクを削除しますか？",dateToday:"今日",dateYesterday:"昨日",noHistory:"まだ履歴はありません。",status:"状態",categoryNames:{study:"勉強",water:"水を飲む",exercise:"運動",laundry:"洗濯",other:"そのほか"}
    }
  };
  const icons = {study:"📚",water:"💧",exercise:"🌿",laundry:"🧺",other:"🌷"};
  const statusKeys = {done:"done",snoozed:"snoozed",skipped:"skipped",pending:"pending"};
  let lang = localStorage.getItem(LANG_KEY) || "en";
  let filter = "all";
  let view = "today";
  let tasks = [];
  let history = [];
  const $ = id => document.getElementById(id);
  const t = key => (translations[lang] && translations[lang][key]) || translations.en[key] || key;
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      tasks = Array.isArray(saved.tasks) ? saved.tasks : [];
      history = Array.isArray(saved.history) ? saved.history : [];
    } catch (_) { tasks = []; history = []; }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({tasks,history})); }
    catch (_) { announce(t("catDefault")); }
    syncReminderTasks();
  }
  function syncReminderTasks() {
    if (!window.catDesktop || typeof window.catDesktop.syncTasks !== "function") return;
    window.catDesktop.syncTasks(tasks,lang).catch(() => {});
  }
  function applyLanguage() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (t(key) != null) el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    $("language-select").value = lang;
    $("task-title").setAttribute("aria-label", t("taskName"));
    $("task-time").setAttribute("aria-label", t("dueTime"));
    $("task-category").setAttribute("aria-label", t("category"));
    $("chat-input").setAttribute("aria-label", t("chatPlaceholder"));
    $("today-date").textContent = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : lang === "kn" ? "kn-IN" : lang === "ja" ? "ja-JP" : "en-US", {weekday:"short",month:"long",day:"numeric"}).format(new Date());
    render();
  }
  function categoryName(category) { return (translations[lang].categoryNames || translations.en.categoryNames)[category] || t("other"); }
  function addHistory(task, status) {
    history.unshift({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),taskId:task.id,title:task.title,category:task.category,status,time:new Date().toISOString(),due:task.due || ""});
    if (history.length > 250) history = history.slice(0,250);
  }
  function setStatus(id, status) {
    const task = tasks.find(item => item.id === id);
    if (!task || (task.status || "pending") !== "pending") return;
    if (status === "snooze" || status === "later") {
      const minutes = status === "snooze" ? 10 : 60;
      task.snoozeUntil = new Date(Date.now()+minutes*60000).toISOString();
      task.status = "pending";
      task.updatedAt = new Date().toISOString();
      addHistory(task,"snoozed");
      persist(); render(); announce(status === "snooze" ? t("taskSnoozed") : "Mochi will remind you in one hour."); return;
    }
    task.status = status;
    task.updatedAt = new Date().toISOString();
    if (status === "done" || status === "skipped") {
      task.completedAt = task.updatedAt;
      addHistory(task,status);
    }
    persist(); render(); announce(t(status === "done" ? "taskCompleted" : "taskSkipped"));
  }
  function makeTask(title, category, due) {
    const task = {id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),title:title.trim(),category,due,status:"pending",createdAt:new Date().toISOString()};
    tasks.unshift(task); persist(); render(); announce(t("taskAdded")); return task;
  }
  function render() {
    const pending = tasks.filter(x=>x.status === "pending").length;
    const done = tasks.filter(x=>x.status === "done").length;
    const total = tasks.length;
    $("nav-count").textContent = pending;
    $("tasks-left").textContent = pending;
    $("tasks-done").textContent = done;
    const percent = total ? Math.round(done/total*100) : 0;
    $("progress-percent").textContent = percent + "%";
    $("progress-bar").style.width = percent + "%";
    const visible = tasks.filter(task => filter === "all" || (filter === "pending" && task.status === "pending") || (filter === "done" && task.status === "done"));
    $("task-list").innerHTML = visible.map(task => {
      const status = task.status || "pending";
      const dueText = task.due ? t("due") + " · " + esc(task.due) : t("noDue");
      const statusLabel = t(statusKeys[status] || "pending");
      let actionHTML = "";
      if (status === "pending") {
        actionHTML = '<button class="small-action done-action" data-action="done" data-id="'+esc(task.id)+'">'+esc(t("doneButton"))+'</button><button class="small-action" data-action="snooze" data-id="'+esc(task.id)+'">'+esc(t("snoozeButton"))+'</button><button class="small-action" data-action="skipped" data-id="'+esc(task.id)+'">'+esc(t("skipButton"))+'</button>';
      } else {
        actionHTML = '<span class="task-status '+esc(status)+'">'+esc(statusLabel)+'</span>';
      }
      return '<article class="task-card '+(status==="done"?"is-complete":"")+'"><div class="task-icon category-'+esc(task.category)+'">'+(icons[task.category]||icons.other)+'</div><div class="task-meta"><div class="task-title">'+esc(task.title)+'</div><div class="task-sub"><span class="category-pill">'+esc(categoryName(task.category))+'</span><span class="due-pill">◷ '+dueText+'</span></div></div><div class="task-actions">'+actionHTML+'<button class="small-action" title="'+esc(t("deleteButton"))+'" aria-label="'+esc(t("deleteButton"))+'" data-action="remove" data-id="'+esc(task.id)+'">×</button></div></article>';
    }).join("");
    $("empty-state").classList.toggle("hidden", visible.length > 0);
    $("task-list").classList.toggle("hidden", visible.length === 0);
    $("history-list").innerHTML = history.map(entry => {
      const statusLabel = t(entry.status==="done"?"historyDone":entry.status==="snoozed"?"historySnoozed":"historySkipped");
      const date = new Date(entry.time);
      const dateLabel = new Intl.DateTimeFormat(lang==="hi"?"hi-IN":lang==="kn"?"kn-IN":lang==="ja"?"ja-JP":"en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(date);
      return '<div class="history-entry"><div class="history-icon">'+(icons[entry.category]||icons.other)+'</div><div class="history-text"><strong>'+esc(entry.title)+'</strong><small>'+esc(categoryName(entry.category))+' · '+esc(dateLabel)+'</small></div><span class="history-status">'+esc(statusLabel)+'</span></div>';
    }).join("");
    $("history-empty").classList.toggle("hidden",history.length>0);
  }
  let toastTimer;
  function announce(message) {
    let el = $("status-toast");
    if (!el) {
      el = document.createElement("div"); el.id = "status-toast"; el.setAttribute("role","status");
      el.style.cssText = "position:fixed;z-index:100;left:50%;bottom:20px;transform:translateX(-50%);background:#614d57;color:#fff;padding:11px 16px;border-radius:12px;font-size:12px;box-shadow:0 10px 30px #5a3b4b24;max-width:calc(100vw - 30px);text-align:center";
      document.body.appendChild(el);
    }
    el.textContent = message; el.style.display = "block";
    clearTimeout(toastTimer); toastTimer = setTimeout(()=>{el.style.display="none"},2600);
  }
  function showView(name) {
    view = name;
    $("today-view").classList.toggle("hidden",name!=="today");
    $("history-view").classList.toggle("hidden",name!=="history");
    document.querySelectorAll(".nav-item[data-view]").forEach(el => el.classList.toggle("active",el.dataset.view===name));
  }
  function addChatMessage(text, role) {
    const messages = $("chat-messages");
    const div = document.createElement("div"); div.className = "message "+role; div.textContent = text;
    messages.appendChild(div); messages.scrollTop = messages.scrollHeight;
  }
  function catReply(prompt) {
    if (prompt === "motivate") return t("catMotivate");
    if (prompt === "break") return t("catBreak");
    if (prompt === "focus") return t("catFocus");
    return t("catDefault");
  }
  function sendChat(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    addChatMessage(trimmed,"user");
    addChatMessage(catReply("default"),"cat");
  }
  $("task-form").addEventListener("submit", event => {
    event.preventDefault();
    const title = $("task-title").value.trim();
    if (!title) { $("task-title").focus(); return; }
    makeTask(title,$("task-category").value,$("task-time").value);
    $("task-form").reset();
    $("task-title").focus();
  });
  $("open-add").addEventListener("click",()=>{
    if (!$("chat-dock").classList.contains("collapsed")) $("chat-toggle").click();
    $("task-form").scrollIntoView({behavior:"smooth",block:"center"});
    $("task-title").focus();
  });
  $("empty-add").addEventListener("click",()=>{$("task-title").focus();});
  $("task-list").addEventListener("click", event => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const {action,id} = btn.dataset;
    if (action === "remove") {
      if (!window.confirm(t("confirmRemove"))) return;
      const idx = tasks.findIndex(task=>task.id===id);
      if (idx>=0) { tasks.splice(idx,1); persist(); render(); announce(t("taskRemoved")); }
    } else setStatus(id,action);
  });
  if (window.catDesktop && typeof window.catDesktop.onReminderAction === "function") {
    window.catDesktop.onReminderAction(payload => {
      if (!payload || typeof payload.taskId !== "string") return;
      const action = payload.action === "snooze" ? "snooze" : payload.action === "later" ? "later" : payload.action === "done" ? "done" : "";
      if (action) setStatus(payload.taskId,action);
    });
  }
  if (window.catDesktop && typeof window.catDesktop.onChatReminderHistory === "function") {
    window.catDesktop.onChatReminderHistory(entry => {
      if (!entry || typeof entry.id !== "string" || typeof entry.taskId !== "string" ||
          typeof entry.title !== "string" || !["done", "snoozed"].includes(entry.status)) return;
      if (history.some(item => item.id === entry.id)) return;
      history.unshift({
        id: entry.id,
        taskId: entry.taskId,
        title: entry.title,
        category: "other",
        status: entry.status,
        time: typeof entry.time === "string" ? entry.time : new Date().toISOString(),
        due: typeof entry.due === "string" ? entry.due : ""
      });
      if (history.length > 250) history = history.slice(0,250);
      persist(); render();
      announce(t(entry.status === "done" ? "taskCompleted" : "taskSnoozed"));
    });
  }
  document.querySelectorAll(".filter-chip").forEach(btn => btn.addEventListener("click",()=>{
    filter=btn.dataset.filter;
    document.querySelectorAll(".filter-chip").forEach(el=>el.classList.toggle("selected",el===btn));
    render();
  }));
  document.querySelectorAll(".nav-item[data-view]").forEach(btn=>btn.addEventListener("click",()=>showView(btn.dataset.view)));
  $("back-today").addEventListener("click",()=>showView("today"));
  $("language-select").addEventListener("change",event=>{
    lang=translations[event.target.value]?event.target.value:"en";
    try {localStorage.setItem(LANG_KEY,lang);} catch (_) {}
    applyLanguage();
    syncReminderTasks();
  });
  $("chat-toggle").addEventListener("click",()=>{
    $("chat-dock").classList.toggle("collapsed");
    $("chat-toggle").textContent=$("chat-dock").classList.contains("collapsed")?"⌃":"⌄";
  });
  document.querySelectorAll(".quick-prompts button").forEach(btn=>btn.addEventListener("click",()=>{
    addChatMessage(t(btn.dataset.prompt==="motivate"?"motivateMe":btn.dataset.prompt==="break"?"takeBreak":"focusTip"),"user");
    addChatMessage(catReply(btn.dataset.prompt),"cat");
  }));
  $("chat-form").addEventListener("submit",event=>{
    event.preventDefault();const input=$("chat-input");sendChat(input.value);input.value="";
  });
  loadState();
  if (!tasks.length) {
    const now = new Date();
    const inMinutes = mins => {const d=new Date(now.getTime()+mins*60000);return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");};
    tasks = [
      {id:"sample-study",title:"Review Java notes",category:"study",due:"10:30",status:"pending",createdAt:now.toISOString(),sample:true},
      {id:"sample-water",title:"Drink a glass of water",category:"water",due:inMinutes(20),status:"pending",createdAt:now.toISOString(),sample:true},
      {id:"sample-exercise",title:"Take a 10-minute stretch break",category:"exercise",due:"16:00",status:"pending",createdAt:now.toISOString(),sample:true},
      {id:"sample-laundry",title:"Start a load of laundry",category:"laundry",due:"18:00",status:"pending",createdAt:now.toISOString(),sample:true}
    ];
    persist();
  }
  syncReminderTasks();
  applyLanguage();
})();