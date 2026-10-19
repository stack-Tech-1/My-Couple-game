/**
 * Word Duel targets. Hand-picked: common, unambiguous, nothing obscure or unkind.
 * Every entry must also exist in valid5 (enforced by a unit test).
 */
export const ANSWERS = `
about above actor acute adore adult after again agree ahead alarm album alert alike alive allow alone along alter amber
amaze among angel anger angle apple apply apron arena argue arise armor aroma arrow aside asset audio avoid awake award
aware bacon badge bagel baker basic basil batch beach beard beast begin being below bench berry bible birth black blade
blame blank blaze blend bless blind blink bliss block bloom blush board boast bonus boost booth brain brave bread break
breed brick bride brief bring brisk broad brook brown brush buddy build bunch bunny burst cabin cable cacao camel candy
canoe cargo carry catch cause chain chair chalk charm chart chase cheap check cheek cheer chess chest chick chief child
chill choir chord civic claim class clean clear clerk click cliff climb clock close cloth cloud clove coach coast cocoa
color comet comic coral couch could count court cover craft crane crash crate crawl crazy cream crisp crowd crown crumb
crust curve cycle daily dairy dance dandy dated dealt delay dense depth diary dizzy dodge donut doubt dough draft
drama dream dress drift drink drive eager eagle early earth easel eight elbow elder empty enjoy enter entry equal error
event every exact extra fable faint fairy faith false fancy feast fence ferry fever fiber field fifth fight final first
flame flash fleet flock flood floor flour fluid flute focus foggy force forge forth forty forum found frame fresh front
frost fruit fudge funny fuzzy giant glass gleam glide globe glory glove grace grade grain grand grape graph grasp grass
great green greet grill groan group grove guard guess guest guide habit happy harsh haste heart heavy hedge hello hobby
honey honor horse hotel house human humor hurry ideal image inner input irony issue ivory jelly jewel joint jolly judge
juice jumbo kayak kebab knead kneel knife knock label laser later laugh layer learn lemon level light lilac limit linen
lodge logic loose lucky lunar lunch magic major maple march match mayor medal melon mercy merit merry metal minor mirth
model money month moral motor mount mouse mouth movie music naive nerve never night noble noise north novel nurse ocean
offer often olive onion opera orbit order other otter outer owner paint panda panel paper party pasta patch peace peach
pearl pedal penny perch petal phone photo piano picky piece pilot pinch pixel pizza place plain plane plant plate plaza
plush point polar porch pouch pound power press price pride prime print prize proof proud prune pulse punch puppy
queen query quest quick quiet quilt quirk quite quote radar radio raise rally ranch range rapid raven reach react ready
realm relax relay reply rhyme ridge right rival river roast robin robot rocky roman round route royal ruler rusty salad
sauce scale scarf scene scent scoop score scout scrub sense serve seven shade shake shape share shark sharp sheep shelf
shell shift shine shiny shirt shock shore short shout shrug sight silly since skate skill skirt sleep slice slide smart
smile smoke snack snail snake snowy solar solid solve sorry sound south space spare spark speak spell spend spice spoon
sport spray squad stack stage stair stamp stand start state steam steel steep stick still stone stood store storm story
stove straw strip study style sugar suite sunny super swamp sweet swift swing sword table taste teach thank theme thick
thing think three throw thumb tiger tight toast today topic torch total touch tough towel tower trace track trade trail
train treat trend trial tribe trick truly trunk trust truth tulip tutor twice twist ultra uncle under unity until upper
upset urban usual valid value vapor vault video vigor vinyl visit vital vivid vocal voice waltz watch water weave
wheat wheel where while whirl whole windy witty woman world worry worth would wrist write yacht yearn yeast young youth
zebra zesty
`
  .split(/\s+/)
  .filter((w) => w.length === 5);