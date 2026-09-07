export type QuizQuestion = {
  id: string
  category: string
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  fcpReference: string
}

export type QuizAttempt = {
  id: string
  staffId: string
  staffName: string
  quizVersion: string
  answers: {
    questionId: string
    selectedAnswer: string
    correctAnswer: string
    isCorrect: boolean
  }[]
  score: number
  totalQuestions: number
  percentage: number
  result: 'PASS' | 'FAIL'
  completedAt: string
}

export const STAFF_QUIZ_VERSION = 'food-safety-v2-2026-05'
export const STAFF_QUIZ_QUESTION_COUNT = 20

export const STAFF_QUIZ_QUESTION_BANK: QuizQuestion[] = [
  {
    id: 'Q001',
    category: 'Hand washing',
    question: 'How long must staff wash their hands in soapy water?',
    options: ['5 seconds', '10 seconds', '20 seconds', '1 minute'],
    correctAnswer: '20 seconds',
    explanation:
      'Staff must wash hands in soapy water for 20 seconds and dry them thoroughly. This reduces the risk of transferring bugs to food.',
    fcpReference: 'Managing personal hygiene and health',
  },
  {
    id: 'Q002',
    category: 'Hand washing',
    question: 'When must hands be washed?',
    options: [
      'Only at the start of the shift',
      'Before handling food and after using the toilet, phone, rubbish, coughing or touching something dirty',
      'Only when they look dirty',
      'Only after handling raw meat',
    ],
    correctAnswer:
      'Before handling food and after using the toilet, phone, rubbish, coughing or touching something dirty',
    explanation: 'Hands must be washed before handling food and after activities that may contaminate hands.',
    fcpReference: 'Managing personal hygiene and health',
  },
  {
    id: 'Q003',
    category: 'Gloves',
    question: 'When must gloves be changed?',
    options: [
      'Only once per day',
      'After touching raw food, rubbish, phone, dirty surfaces or anything other than ready-to-eat food',
      'Only when they tear',
      'Gloves never need changing if hands are clean',
    ],
    correctAnswer:
      'After touching raw food, rubbish, phone, dirty surfaces or anything other than ready-to-eat food',
    explanation:
      'Dirty gloves can contaminate food. Gloves must be changed between raw and cooked foods and after touching anything that could contaminate them.',
    fcpReference: 'Managing personal hygiene and health',
  },
  {
    id: 'Q004',
    category: 'Sickness',
    question: 'A staff member had vomiting or diarrhoea yesterday. What should happen?',
    options: [
      'They can work if they wear gloves',
      'They can work only with cooked food',
      'They must stay away from food areas until 48 hours after symptoms stop',
      'They can work if they wash hands more often',
    ],
    correctAnswer: 'They must stay away from food areas until 48 hours after symptoms stop',
    explanation:
      'Vomiting and diarrhoea can spread harmful bugs. Staff must stay away from food preparation areas until 48 hours after symptoms have stopped.',
    fcpReference: 'Managing personal hygiene and health',
  },
  {
    id: 'Q005',
    category: 'Clean clothing',
    question: 'What must staff wear before handling food or entering food preparation areas?',
    options: ['Any clothing', 'Clean clothing or clean protective clothing such as aprons', 'Outdoor jackets', 'Only gloves'],
    correctAnswer: 'Clean clothing or clean protective clothing such as aprons',
    explanation: 'Dirty clothing can contaminate food, surfaces and equipment.',
    fcpReference: 'Managing personal hygiene and health',
  },
  {
    id: 'Q006',
    category: 'Cold food',
    question: 'What temperature must chilled food be kept at or below?',
    options: ['2C', '5C', '10C', '15C'],
    correctAnswer: '5C',
    explanation:
      "Chilled food must be kept cold to stop bugs growing quickly. Caterstation's questionnaire uses 5C as the fridge limit.",
    fcpReference: 'Keeping food cold',
  },
  {
    id: 'Q007',
    category: 'Fridge checking',
    question: 'What is the best way to check chilled food temperature?',
    options: [
      'Guess by touching the packet',
      'Use a clean probe thermometer in food or a water glass used for fridge checking',
      'Use a laser thermometer on the outside of the fridge',
      'Check only the fridge light is on',
    ],
    correctAnswer: 'Use a clean probe thermometer in food or a water glass used for fridge checking',
    explanation: 'The important temperature is the food/internal temperature, not just the surface of the fridge.',
    fcpReference: 'Keeping food cold',
  },
  {
    id: 'Q008',
    category: 'Time out of temperature control',
    question: 'How long can cold food be out of the fridge if it is not being heated?',
    options: ['1 hour', '2 hours', '4 hours', 'All day if covered'],
    correctAnswer: '4 hours',
    explanation:
      "Cold food removed from temperature control must be managed carefully. Caterstation's rule is a maximum of 4 hours if not heated.",
    fcpReference: 'Keeping food cold / Displaying food',
  },
  {
    id: 'Q009',
    category: 'Time out of temperature control',
    question: 'What must happen to cold food after the allowed time out of the fridge has passed?',
    options: ['Put it back in the fridge', 'Freeze it', 'Throw it away', 'Sell it quickly'],
    correctAnswer: 'Throw it away',
    explanation:
      'Once food has spent too long in the danger zone, bugs may have grown to unsafe levels. It must be thrown away.',
    fcpReference: 'Keeping food cold / When something goes wrong',
  },
  {
    id: 'Q010',
    category: 'Temperature danger zone',
    question: 'What is the food temperature danger zone?',
    options: ['0C to 5C', '5C to 60C', '60C to 75C', '75C to 100C'],
    correctAnswer: '5C to 60C',
    explanation: 'Harmful bugs grow more quickly between 5C and 60C.',
    fcpReference: 'Keeping food cold / Keeping food hot',
  },
  {
    id: 'Q011',
    category: 'Returned boxes',
    question: 'When a returned box comes back to site, what must be checked?',
    options: [
      'Only the colour of the box',
      'Whether it is clean and free from pests or contamination',
      'Nothing if it looks okay from far away',
      'Only the delivery label',
    ],
    correctAnswer: 'Whether it is clean and free from pests or contamination',
    explanation:
      'Pests can spread disease and contaminate food, surfaces and packaging. Returned items must not bring contamination back into the business.',
    fcpReference: 'Checking for pests',
  },
  {
    id: 'Q012',
    category: 'Raw food',
    question: 'After processing raw food, what must happen before using the area again?',
    options: [
      'Only wipe the bench with a dry cloth',
      'Sanitise prep areas and clean/sanitise knives and boards or send them to the dishwasher',
      'Do nothing if the next food is also cold',
      'Only change gloves',
    ],
    correctAnswer: 'Sanitise prep areas and clean/sanitise knives and boards or send them to the dishwasher',
    explanation:
      'Raw food can spread harmful bugs. Food contact surfaces, equipment and utensils must be cleaned and sanitised.',
    fcpReference: 'Preparing food safely / Separating food',
  },
  {
    id: 'Q013',
    category: 'Allergens',
    question: 'Which of these is a recognised food allergen?',
    options: ['Sesame', 'Salt', 'Water', 'Black pepper'],
    correctAnswer: 'Sesame',
    explanation:
      'Common allergens include gluten-containing cereals, shellfish, eggs, fish, milk, peanuts, soybeans, sesame, tree nuts, lupin and sulphites.',
    fcpReference: 'Knowing what is in your food',
  },
  {
    id: 'Q014',
    category: 'Gluten claim',
    question: 'What should Caterstation staff say about products where no gluten is added, but gluten-free is not claimed?',
    options: [
      'They are definitely gluten-free',
      'They contain extra gluten',
      'No gluten is added, but we do not claim gluten-free unless confirmed',
      'Gluten does not matter',
    ],
    correctAnswer: 'No gluten is added, but we do not claim gluten-free unless confirmed',
    explanation:
      'Food suitability includes making sure claims are true. Do not make a gluten-free claim unless the business can support it.',
    fcpReference: 'Taking responsibility / Knowing what is in your food',
  },
  {
    id: 'Q015',
    category: 'Deliveries',
    question: 'What must happen when chilled meat is delivered?',
    options: ['Accept it without checking', 'Check temperature where required and record the delivery', 'Leave it outside until later', 'Only check the invoice'],
    correctAnswer: 'Check temperature where required and record the delivery',
    explanation:
      'Deliveries from trusted suppliers must be checked and records kept where required, including temperature if applicable.',
    fcpReference: 'Sourcing, receiving and storing food',
  },
  {
    id: 'Q016',
    category: 'Cooking chicken',
    question: "What is Caterstation's fried chicken check?",
    options: ['Cook until golden only', 'Probe the largest piece to confirm 75C for 30 seconds', 'Cook for 1 minute only', 'Check by smell'],
    correctAnswer: 'Probe the largest piece to confirm 75C for 30 seconds',
    explanation:
      "Chicken must be thoroughly cooked. Caterstation's process is to confirm the largest piece reaches 75C for 30 seconds.",
    fcpReference: 'Cooking poultry, minced meat and liver',
  },
  {
    id: 'Q017',
    category: 'Cooking records',
    question: "How often is Caterstation's fried chicken cooking method checked and recorded?",
    options: ['Daily', 'Weekly', 'Monthly', 'Never'],
    correctAnswer: 'Weekly',
    explanation:
      "The method must be checked regularly to confirm it still works. Caterstation's current process is weekly and recorded.",
    fcpReference: 'Cooking poultry, minced meat and liver / Proving the method works',
  },
  {
    id: 'Q018',
    category: 'Reheating',
    question: 'What temperature must reheated food reach?',
    options: ['60C', '65C', '75C for 30 seconds', '100C for 10 minutes'],
    correctAnswer: '75C for 30 seconds',
    explanation: "Reheated food must reach a safe internal temperature. Caterstation's rule is 75C for 30 seconds.",
    fcpReference: 'Reheating food',
  },
  {
    id: 'Q019',
    category: 'Cooling',
    question: 'What is the correct cooling rule for freshly cooked food?',
    options: [
      'Cool from 60C to 21C within 2 hours, then from 21C to 5C within a further 4 hours',
      'Leave on bench overnight',
      'Cool to 30C within 6 hours',
      'Freeze immediately while boiling hot',
    ],
    correctAnswer: 'Cool from 60C to 21C within 2 hours, then from 21C to 5C within a further 4 hours',
    explanation:
      'Cooling must happen quickly enough to stop harmful bugs growing. The FCP record template states 60C to 21C within 2 hours, then 21C to 5C or lower within a further 4 hours.',
    fcpReference: 'Cooling freshly cooked food',
  },
  {
    id: 'Q020',
    category: 'Defrosting',
    question: 'How should frozen meat normally be defrosted?',
    options: ['On the bench at room temperature', 'In the fridge ahead of time', 'In warm water overnight', 'Outside in the sun'],
    correctAnswer: 'In the fridge ahead of time',
    explanation: 'Defrosting in the fridge keeps food cold while it thaws and reduces the risk of bugs growing.',
    fcpReference: 'Defrosting food',
  },
  {
    id: 'Q021',
    category: 'Cleaning',
    question: 'What must happen to food contact surfaces during cleaning?',
    options: [
      'Only sweep the floor',
      'Clean and sanitise surfaces that come into contact with food',
      'Spray air freshener',
      'Wipe with a dry towel only',
    ],
    correctAnswer: 'Clean and sanitise surfaces that come into contact with food',
    explanation: 'Food contact surfaces must be cleaned and sanitised to prevent contamination.',
    fcpReference: 'Cleaning up and closing',
  },
  {
    id: 'Q022',
    category: 'Chemicals',
    question: 'What must staff do when using cleaning chemicals?',
    options: [
      'Mix chemicals without checking',
      'Always follow the instructions and use food-grade cleaning chemicals where required',
      'Use more chemical than instructed',
      'Store chemicals above open food',
    ],
    correctAnswer: 'Always follow the instructions and use food-grade cleaning chemicals where required',
    explanation: 'Chemicals can make people sick if they contaminate food. Staff must follow instructions and keep chemicals away from food.',
    fcpReference: 'Cleaning up and closing',
  },
  {
    id: 'Q023',
    category: 'Rubbish',
    question: 'When should rubbish be removed from processing areas?',
    options: ['Only once per week', 'At the end of the day and when bins are full', 'Never', 'Only when a customer sees it'],
    correctAnswer: 'At the end of the day and when bins are full',
    explanation: 'Rubbish can attract pests and contaminate food areas, so it must be removed regularly.',
    fcpReference: 'Cleaning up and closing / Checking for pests',
  },
  {
    id: 'Q024',
    category: 'Thermometer calibration',
    question: 'How often should thermometers be checked/calibrated?',
    options: ['Never', 'Every 6-12 months or as manufacturer instructions say', 'Only after they break', 'Every 10 years'],
    correctAnswer: 'Every 6-12 months or as manufacturer instructions say',
    explanation:
      'Thermometer calibration is like a WOF for the thermometer. An inaccurate thermometer can lead to unsafe food.',
    fcpReference: 'Thermometer calibration guidance',
  },
  {
    id: 'Q025',
    category: 'Records',
    question: 'What information must food safety records show?',
    options: ["Only the staff member's first name", 'What was done, when it was done, and who did it', 'Only the date', 'Only a tick with no details'],
    correctAnswer: 'What was done, when it was done, and who did it',
    explanation:
      'Records must be accurate, easy to read, and identify what was done, when it was done, and who did it.',
    fcpReference: 'Taking responsibility',
  },
]

export type QuizQuestionForAttempt = QuizQuestion & { shuffledOptions: string[] }

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function buildQuizQuestionSet(count = STAFF_QUIZ_QUESTION_COUNT): QuizQuestionForAttempt[] {
  const selected = shuffle(STAFF_QUIZ_QUESTION_BANK).slice(0, Math.max(1, Math.min(count, STAFF_QUIZ_QUESTION_BANK.length)))
  return selected.map((question) => ({
    ...question,
    shuffledOptions: shuffle(question.options),
  }))
}
