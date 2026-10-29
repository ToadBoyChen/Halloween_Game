// ─────────────────────────────────────────────────────────────
//  RITUALS (tasks)
//
//  Add a ritual:     add an entry below (id must be unique).
//  Remove a ritual:  delete it, or set `enabled: false`.
//  Chain rituals:    set `requires` to another ritual's id. It stays
//                    locked until that one is done. A chain goes into
//                    the game whole, first step first, and never skips a
//                    middle step. Switch off a middle step and the steps
//                    after it are left out too (the hub lobby warns you).
//  Ask a question:   set `answer` and `choices` (e.g. hide a note with a
//                    number on it). The phone shows the answer plus a few
//                    random wrong `choices`, and the player must tap the
//                    right one to finish. A wrong tap locks them out briefly.
//                    Change the note between games so nobody remembers it.
//  You can also switch rituals on/off in the hub lobby without
//  redeploying.
// ─────────────────────────────────────────────────────────────

export type Ritual = {
  id: string;
  name: string;
  location: string;
  instructions: string;
  requires?: string; // id of a ritual that must be done first
  answer?: string; // the player must pick this to finish the ritual…
  choices?: string[]; // …from it plus a few of these wrong ones
  enabled?: boolean;
};

export const ANSWER_OPTIONS = 4; // how many choices the phone shows (1 right, the rest wrong)
export const WRONG_ANSWER_LOCKOUT = 10; // seconds a player waits after a wrong answer

export const RITUALS: Ritual[] = [
  {
    id: "n0",
    name: "Cursed Notes",
    location: "Toby's Room",
    instructions: "100 notes are scattered around in a box. Find the note with a star on the back and keep it on you.",
  },
  {
    id: "n1",
    requires: "n0",
    name: "Passing the Note",
    location: "Kitchen",
    instructions: "There is a 100 note with a star on the back. One of you has it. Find it and pin it to the notice board.",
  },
  {
    id: "b1",
    name: "Devil Balloon",
    location: "Jay's Living Room",
    instructions: "There are balloons in Jay's living room, but one is cursed. Find the devil balloon and put in on Joey's bed.",
  },
  {
    id: "b2",
    name: "Angel Balloon",
    location: "Jay's Living Room",
    instructions: "There are balloon in Jay's living room and one is blessed. Find the angel balloon and hand it to someone. They have to hand that balloon to someone, and so fourth.",
  },
  {
    id: "b3",
    name: "Clown Balloon",
    location: "Jay's Living Room",
    instructions: "There are balloons in Jay's living room and one is a clown. Find the clown balloon and put it in Toby's room, in one of the boxes.",
  },
  {
    id: "v1",
    name: "Verity Calls",
    location: "Jay's Bathroom",
    instructions: "Verity calls to you. Find the yellow balloon with a smiley face and bring it to the wheelbarrow outside.",
  },
  {
    id: "v2",
    requires: "v2",
    name: "Verity Hides",
    location: "Wheel Barrow",
    instructions: "Verity calls to you. Verity is outside and lost. Bring them back into the house. Hide them under the dining room table. Look near Jay's van.",
  },
  {
    id: "v3",
    requires: "v2",
    name: "Verity Spies",
    location: "Toby's Room",
    instructions: "Verity calls to you. Place Verity under Toby's desk. They are under the dining room table.",
  },
  {
    id: "v4",
    requires: "v3",
    name: "Verity Goes Home",
    location: "Jay's Bathroom",
    instructions: "Verity calls to you. Place Verity in Jay's bathroom. They are under Toby's desk.",
  },
  {
    id: "s1",
    name: "The Laundry",
    location: "Garden Washing Line",
    instructions: "Mildred left some socks out on the trampoline. Hang all 5 up on the washing line.",
  },
  {
    id: "s2",
    requires: "s1",
    name: "Cursed socks",
    location: "Garden Washing Line",
    instructions: "The socks on the washing line are cursed! Place two on your hands, follow someone and scare them!",
  },
  {
    id: "p1",
    name: "Messy Chips",
    location: "Joey's Room",
    instructions: "Joey's gambling addiction has gone too far. Create four stacks of poker chips in colour order.",
  },
  {
    id: "dp1",
    name: "The Dealer's Chip",
    location: "Jay's Fire Pit",
    instructions: "The Dealer's poker chip is cursed apparently. Find it and take it outside. Put it on the kitchen window sill outside.",
  },
  {
    id: "c1",
    name: "Kitchen Messages",
    location: "Kitchen",
    instructions: "There's a code on the kitchen notice board. It will be on a note clearly in view, with a pentagram on it. The answer is the code + 1.",
    answer: "238",
    choices: ["237", "236", "238", "239"],
  },
  {
    id: "g2",
    requires: "g1",
    name: "Sharp Shooter",
    location: "Living Room",
    instructions: "The Living room has a stack of cups. Shoot them over with a gun near a TV. Once you've shot them down, place the gun on Jay's desk.",
  },
  {
    id: "g1",
    name: "Ancient Gun",
    location: "The Swamp",
    instructions: "Mildred has a gun from a time ago. Find it and place it in front on the TV. Its on a rock in the middle of the smaller pond.",
  },
  {
    id: "g3",
    requires: "g2",
    name: "Cryptid Cups",
    location: "Living Room",
    instructions: "Someone shot down a precious stack of cups. Stack them back up.",
  }, // 17 games so far
  {
    id: "e1",
    name: "Your Balls",
    location: "Fire Pit",
    instructions: "You just remembered that your balls are left all over the fire pit. Find 5 and place them into the green barrel.",
  },
  {
    id: "e2",
    requires: "e1",
    name: "My Balls",
    location: "Jay's Van",
    instructions: "All the balls are in a green barrel. You think they might be better off by the gate. Carry all 5 balls to the gate.",
  },
  {
    id: "x1",
    name: "Suspicions",
    location: "The House",
    instructions: "You have your suspicions about a certain player. Find and follow them for a minute.",
  },
  { // ==============================================================================================================================
    id: "z1",
    name: "Mechanic",
    location: "Jay's Bathroom",
    instructions: "A broken gun is in Jay's bathroom. Fix it and return it to the living room. Place it on the sofa.",
  },
  {
    id: "z2",
    name: "Chilling Chess Black",
    location: "Jay's Living Room",
    instructions: "A ghost wants to play chess. Set up the black pieces.",
  },
  {
    id: "z3",
    name: "Chilling Chess White",
    location: "Jay's Living Room",
    instructions: "A ghost wants to play chess. Set up the white pieces.",
  }, // 23
  { // DONE -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
    id: "z4",
    name: "Cat Cards",
    location: "Living Room",
    instructions: "Find your favourite cat card from the living room. Next emergency meeting, randomly say this is my favourite cat.",
  },
  {
    id: "z5",
    name: "Counting Hearts",
    location: "Mildred's Bathroom",
    instructions: "There is a full set of cards from the heart suit in Mildred's bathroom. Arrange them in order and return them to the living room table.",
  },
  {
    id: "z6",
    name: "Counting Diamonds",
    location: "Toby's Room",
    instructions: "There is a full set of cards from the diamond suit in Toby's Room. Arrange them in order and return them to the living room table.",
  },
  {
    id: "z7",
    name: "Counting Spades",
    location: "Joey's Room",
    instructions: "There is a full set of cards from the spade suit in Joey's Room. Arrange them in order and return them to the living room table.",
  },
  {
    id: "z8",
    name: "Counting Clubs",
    location: "Kitchen",
    instructions: "There is a full set of cards from the club suit in Kitchen. Arrange them in order and return them to the living room table.",
  },
  {
    id: "z9",
    name: "Suspicious Noises",
    location: "Joey's Room",
    instructions: "Find a balloon in Joey's room, blow ip up and let the fart noise out.",
  },
  {
    id: "z11",
    name: "Timeless Codes",
    location: "Mantle Piece",
    instructions: "Find a code on top of the mantle piece in the living room and record it now.",
    answer: "678",
    choices: ["582", "323", "126", "678", "447", "676"],
  },
  {
    id: "z10",
    name: "Water the Swamp Ghoul's Home",
    location: "Garden Pond",
    instructions: "Find the water bucket near the green barrel in the garden, fill it with a little bit of water and water the smaller pond over the bridge.",
  }, //31
];
