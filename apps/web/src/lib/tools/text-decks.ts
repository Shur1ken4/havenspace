// Word cards (ADR-21). Our own wording, written for HavenSpace.
// CLINICAL-REVIEW (docs/clinical-review.md item 19): the Clinical Lead reviews both lists.

type L = { en: string; ru: string };

/** "Words": single words to pair with a picture card or to use on their own. */
export const WORD_CARDS: L[] = [
  { en: "Home", ru: "Дом" }, { en: "Road", ru: "Дорога" }, { en: "Fear", ru: "Страх" }, { en: "Hope", ru: "Надежда" },
  { en: "Mother", ru: "Мама" }, { en: "Father", ru: "Папа" }, { en: "Child", ru: "Ребёнок" }, { en: "Family", ru: "Семья" },
  { en: "Friend", ru: "Друг" }, { en: "Stranger", ru: "Чужой" }, { en: "Love", ru: "Любовь" }, { en: "Loneliness", ru: "Одиночество" },
  { en: "Closeness", ru: "Близость" }, { en: "Distance", ru: "Дистанция" }, { en: "Anger", ru: "Гнев" }, { en: "Joy", ru: "Радость" },
  { en: "Shame", ru: "Стыд" }, { en: "Guilt", ru: "Вина" }, { en: "Hurt", ru: "Обида" }, { en: "Forgiveness", ru: "Прощение" },
  { en: "Envy", ru: "Зависть" }, { en: "Pride", ru: "Гордость" }, { en: "Tiredness", ru: "Усталость" }, { en: "Rest", ru: "Отдых" },
  { en: "Body", ru: "Тело" }, { en: "Money", ru: "Деньги" }, { en: "Work", ru: "Работа" }, { en: "Play", ru: "Игра" },
  { en: "Duty", ru: "Долг" }, { en: "Freedom", ru: "Свобода" }, { en: "Choice", ru: "Выбор" }, { en: "Boundary", ru: "Граница" },
  { en: "Secret", ru: "Тайна" }, { en: "Loss", ru: "Потеря" }, { en: "Gratitude", ru: "Благодарность" }, { en: "Beginning", ru: "Начало" },
  { en: "Ending", ru: "Конец" }, { en: "Change", ru: "Перемены" }, { en: "Support", ru: "Опора" }, { en: "Trust", ru: "Доверие" },
  { en: "Control", ru: "Контроль" }, { en: "Waiting", ru: "Ожидание" }, { en: "Mistake", ru: "Ошибка" }, { en: "Help", ru: "Помощь" },
  { en: "Dream", ru: "Мечта" }, { en: "Wish", ru: "Желание" }, { en: "Past", ru: "Прошлое" }, { en: "Future", ru: "Будущее" },
  { en: "Childhood", ru: "Детство" }, { en: "Silence", ru: "Тишина" }, { en: "Tears", ru: "Слёзы" }, { en: "Laughter", ru: "Смех" },
  { en: "Strength", ru: "Сила" }, { en: "Weakness", ru: "Слабость" }, { en: "Peace", ru: "Покой" }, { en: "Courage", ru: "Смелость" },
  { en: "Responsibility", ru: "Ответственность" }, { en: "Habit", ru: "Привычка" }, { en: "Promise", ru: "Обещание" }, { en: "Me", ru: "Я" },
];

/** "Inner resources": a quality, and a question the therapist may ask about it. */
export const RESOURCE_CARDS: { word: L; question: L }[] = [
  { word: { en: "Patience", ru: "Терпение" }, question: { en: "When has patience helped you?", ru: "Когда терпение вам помогло?" } },
  { word: { en: "Courage", ru: "Смелость" }, question: { en: "When were you braver than you expected?", ru: "Когда вы были смелее, чем ожидали от себя?" } },
  { word: { en: "Calm", ru: "Спокойствие" }, question: { en: "Where and with whom do you feel calm?", ru: "Где и с кем вам спокойно?" } },
  { word: { en: "Curiosity", ru: "Любопытство" }, question: { en: "What would you like to learn or try?", ru: "Что вам хотелось бы узнать или попробовать?" } },
  { word: { en: "Humour", ru: "Юмор" }, question: { en: "When has a laugh helped you through something hard?", ru: "Когда смех помог вам пройти через трудное?" } },
  { word: { en: "Kindness", ru: "Доброта" }, question: { en: "Who has been kind to you? To whom are you kind?", ru: "Кто был добр к вам? К кому добры вы?" } },
  { word: { en: "Persistence", ru: "Упорство" }, question: { en: "What have you kept going with, even when it was hard?", ru: "Что вы продолжали делать, даже когда было трудно?" } },
  { word: { en: "Tenderness", ru: "Нежность" }, question: { en: "How do you show tenderness — and how do you receive it?", ru: "Как вы проявляете нежность — и как её принимаете?" } },
  { word: { en: "Honesty", ru: "Честность" }, question: { en: "When did being honest matter to you?", ru: "Когда для вас было важно быть честным?" } },
  { word: { en: "Creativity", ru: "Творчество" }, question: { en: "What do you enjoy making or inventing?", ru: "Что вам нравится создавать или придумывать?" } },
  { word: { en: "Care", ru: "Забота" }, question: { en: "How do you take care of yourself on a hard day?", ru: "Как вы заботитесь о себе в трудный день?" } },
  { word: { en: "Wisdom", ru: "Мудрость" }, question: { en: "What do you know now that you didn't know five years ago?", ru: "Что вы знаете сейчас, чего не знали пять лет назад?" } },
  { word: { en: "Flexibility", ru: "Гибкость" }, question: { en: "When did you find another way round?", ru: "Когда вам удалось найти обходной путь?" } },
  { word: { en: "Faith", ru: "Вера" }, question: { en: "What do you believe in, even when things are uncertain?", ru: "Во что вы верите, даже когда всё неопределённо?" } },
  { word: { en: "Friendship", ru: "Дружба" }, question: { en: "Who would you call if you needed help?", ru: "Кому вы позвонили бы, если бы понадобилась помощь?" } },
  { word: { en: "Body", ru: "Тело" }, question: { en: "What helps your body feel good?", ru: "Что помогает вашему телу чувствовать себя хорошо?" } },
  { word: { en: "Nature", ru: "Природа" }, question: { en: "Which place in nature restores you?", ru: "Какое место на природе вас восстанавливает?" } },
  { word: { en: "Music", ru: "Музыка" }, question: { en: "Which music supports you?", ru: "Какая музыка вас поддерживает?" } },
  { word: { en: "Memory", ru: "Память" }, question: { en: "Which memory warms you?", ru: "Какое воспоминание вас согревает?" } },
  { word: { en: "Gratitude", ru: "Благодарность" }, question: { en: "What are you grateful for today?", ru: "За что вы благодарны сегодня?" } },
  { word: { en: "Boundaries", ru: "Границы" }, question: { en: "When did you manage to say “no”?", ru: "Когда вам удалось сказать «нет»?" } },
  { word: { en: "Rest", ru: "Отдых" }, question: { en: "What truly rests you?", ru: "Что по-настоящему даёт вам отдых?" } },
  { word: { en: "Play", ru: "Игра" }, question: { en: "When did you last play just for fun?", ru: "Когда вы в последний раз играли просто ради удовольствия?" } },
  { word: { en: "Skill", ru: "Мастерство" }, question: { en: "What are you good at?", ru: "Что у вас хорошо получается?" } },
  { word: { en: "Roots", ru: "Корни" }, question: { en: "What did you take from your family that helps you?", ru: "Что вы взяли из своей семьи, что вам помогает?" } },
  { word: { en: "Dream", ru: "Мечта" }, question: { en: "What do you dream about?", ru: "О чём вы мечтаете?" } },
  { word: { en: "Choice", ru: "Выбор" }, question: { en: "What can you choose right now?", ru: "Что вы можете выбрать прямо сейчас?" } },
  { word: { en: "Order", ru: "Порядок" }, question: { en: "What brings order to your day?", ru: "Что вносит порядок в ваш день?" } },
  { word: { en: "Openness", ru: "Открытость" }, question: { en: "What are you ready to let into your life?", ru: "Что вы готовы впустить в свою жизнь?" } },
  { word: { en: "Self-respect", ru: "Самоуважение" }, question: { en: "What do you respect yourself for?", ru: "За что вы себя уважаете?" } },
  { word: { en: "Helping others", ru: "Помощь другим" }, question: { en: "Who have you helped, and what did it give you?", ru: "Кому вы помогли, и что это вам дало?" } },
  { word: { en: "Solitude", ru: "Уединение" }, question: { en: "What does time alone give you?", ru: "Что вам даёт время наедине с собой?" } },
  { word: { en: "Hope", ru: "Надежда" }, question: { en: "What gives you hope?", ru: "Что даёт вам надежду?" } },
  { word: { en: "Small steps", ru: "Маленькие шаги" }, question: { en: "What small step could you take this week?", ru: "Какой маленький шаг вы могли бы сделать на этой неделе?" } },
  { word: { en: "Experience", ru: "Опыт" }, question: { en: "What hard time have you already come through?", ru: "Через какое трудное время вы уже прошли?" } },
  { word: { en: "Love", ru: "Любовь" }, question: { en: "Who or what do you love?", ru: "Кого или что вы любите?" } },
];
