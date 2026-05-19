/** Generates data/words.json — 200 GRE/GMAT/IELTS vocabulary entries */
const fs = require('fs');
const path = require('path');

const RAW = `
Ephemeral|/ɪˈfem.ər.əl/|adjective|Lasting for a very short time.|transient,fleeting|permanent,eternal|GRE,GMAT
Loquacious|/loʊˈkweɪ.ʃəs/|adjective|Tending to talk a great deal.|verbose,garrulous|taciturn,reticent|GRE,IELTS
Equivocal|/ɪˈkwɪv.ə.kəl/|adjective|Open to more than one interpretation.|ambiguous,vague|unequivocal,explicit|GRE,GMAT
Perfidious|/pəˈfɪd.i.əs/|adjective|Deceitful and untrustworthy.|treacherous,disloyal|loyal,faithful|GRE
Obfuscate|/ˈɒb.fʌs.keɪt/|verb|Render unclear; deliberately confuse.|obscure,muddy|clarify,elucidate|GRE,GMAT
Sanguine|/ˈsæŋ.ɡwɪn/|adjective|Optimistic in a difficult situation.|hopeful,confident|pessimistic,gloomy|GRE,GMAT
Laconic|/ləˈkɒn.ɪk/|adjective|Using very few words.|concise,terse|verbose,loquacious|GRE,GMAT
Pellucid|/pəˈluː.sɪd/|adjective|Translucently clear; easily understood.|lucid,transparent|opaque,murky|GRE
Mendacious|/menˈdeɪ.ʃəs/|adjective|Not telling the truth.|dishonest,lying|truthful,sincere|GRE,GMAT
Venerate|/ˈven.ər.eɪt/|verb|Regard with great respect.|revere,honor|despise,disrespect|GRE,IELTS
Garrulous|/ˈɡær.ʊ.ləs/|adjective|Excessively talkative.|chatty,verbose|reserved,laconic|GRE
Inimical|/ɪˈnɪm.ɪ.kəl/|adjective|Harmful or hostile in effect.|adverse,hostile|beneficial,friendly|GRE
Recondite|/ˈrek.ən.daɪt/|adjective|Little known; abstruse.|obscure,esoteric|common,accessible|GRE
Prolix|/ˈproʊ.lɪks/|adjective|Tediously lengthy in speech or writing.|wordy,long-winded|concise,brief|GRE
Soliloquy|/səˈlɪl.ə.kwi/|noun|Speaking one's thoughts aloud when alone.|monologue,aside|dialogue|GRE,IELTS
Abate|/əˈbeɪt/|verb|Become less intense or widespread.|subside,diminish|intensify,increase|GRE,GMAT
Aberration|/ˌæb.əˈreɪ.ʃən/|noun|A departure from what is normal.|anomaly,deviation|norm,standard|GRE
Abhor|/əbˈhɔːr/|verb|Regard with disgust and hatred.|detest,loathe|admire,cherish|GRE
Abstain|/əbˈsteɪn/|verb|Restrain oneself from doing something.|refrain,forgo|indulge,partake|GRE,GMAT
Abstruse|/əbˈstruːs/|adjective|Difficult to understand.|arcane,complex|obvious,clear|GRE
Accolade|/ˈæk.ə.leɪd/|noun|An award or privilege granted.|honor,praise|criticism,rebuke|GRE,GMAT
Acquiesce|/ˌæk.wiˈes/|verb|Accept reluctantly but without protest.|comply,submit|resist,object|GRE
Acumen|/ˈæk.jə.mən/|noun|Ability to make good judgments.|shrewdness,insight|ignorance,ineptitude|GRE,GMAT
Admonish|/ədˈmɒn.ɪʃ/|verb|Warn or reprimand firmly.|rebuke,chide|praise,commend|GRE
Adroit|/əˈdrɔɪt/|adjective|Clever or skillful.|deft,nimble|clumsy,inept|GRE
Adulation|/ˌædʒ.əˈleɪ.ʃən/|noun|Excessive admiration.|flattery,praise|criticism,disdain|GRE
Adversary|/ˈæd.və.ser.i/|noun|One's opponent in a contest.|foe,rival|ally,friend|GRE
Aesthetic|/esˈθet.ɪk/|adjective|Concerned with beauty.|artistic,tasteful|unattractive,ugly|GRE,IELTS
Affable|/ˈæf.ə.bəl/|adjective|Friendly and easy to talk to.|amiable,genial|unfriendly,rude|GRE,GMAT
Affluent|/ˈæf.lu.ənt/|adjective|Having a great deal of money.|wealthy,prosperous|poor,impoverished|GRE,GMAT
Aggrandize|/əˈɡræn.daɪz/|verb|Increase power or status of.|exalt,elevate|belittle,diminish|GRE
Alacrity|/əˈlæk.rə.ti/|noun|Brisk and cheerful readiness.|eagerness,promptness|apathy,reluctance|GRE
Alleviate|/əˈliː.vi.eɪt/|verb|Make suffering less severe.|ease,relieve|aggravate,worsen|GRE,GMAT
Amalgamate|/əˈmæl.ɡə.meɪt/|verb|Combine or unite.|merge,blend|separate,divide|GRE
Ambivalent|/æmˈbɪv.ə.lənt/|adjective|Having mixed feelings.|uncertain,conflicted|certain,resolute|GRE,GMAT
Ameliorate|/əˈmiːl.i.ə.reɪt/|verb|Make something bad better.|improve,enhance|worsen,deteriorate|GRE
Amenable|/əˈmiː.nə.bəl/|adjective|Open and responsive to suggestion.|cooperative,agreeable|uncooperative,defiant|GRE
Amiable|/ˈeɪ.mi.ə.bəl/|adjective|Having a friendly manner.|cordial,pleasant|hostile,unfriendly|GRE
Anachronism|/əˈnæk.rə.nɪ.zəm/|noun|Something belonging to another time.|archaism,relic|innovation,modernity|GRE
Anomaly|/əˈnɒm.ə.li/|noun|Something that deviates from the norm.|irregularity,oddity|normality,standard|GRE,GMAT
Antipathy|/ænˈtɪp.ə.θi/|noun|A deep-seated feeling of dislike.|aversion,hostility|liking,affection|GRE
Apathy|/ˈæp.ə.θi/|noun|Lack of interest or concern.|indifference,lethargy|enthusiasm,passion|GRE,GMAT
Appease|/əˈpiːz/|verb|Pacify by accepting demands.|placate,mollify|provoke,aggravate|GRE
Apprise|/əˈpraɪz/|verb|Inform or tell someone.|notify,advise|conceal,withhold|GRE
Approbation|/ˌæp.rəˈbeɪ.ʃən/|noun|Approval or praise.|commendation,endorsement|condemnation,criticism|GRE
Arbitrary|/ˈɑː.bɪ.trər.i/|adjective|Based on random choice.|capricious,random|reasoned,systematic|GRE,GMAT
Arcane|/ɑːˈkeɪn/|adjective|Understood by few.|esoteric,mysterious|common,obvious|GRE
Arduous|/ˈɑː.dʒu.əs/|adjective|Involving great effort.|strenuous,laborious|easy,effortless|GRE,IELTS
Articulate|/ɑːˈtɪk.jə.lət/|adjective|Fluent and clear in speech.|eloquent,coherent|inarticulate,unclear|GRE,IELTS
Artifice|/ˈɑː.tɪ.fɪs/|noun|Clever trick or deception.|ruse,stratagem|honesty,sincerity|GRE
Ascetic|/əˈset.ɪk/|adjective|Characterized by severe self-discipline.|austere,abstinent|indulgent,hedonistic|GRE
Assuage|/əˈsweɪdʒ/|verb|Make an unpleasant feeling less intense.|alleviate,soothe|aggravate,intensify|GRE
Austerity|/ɒsˈter.ə.ti/|noun|Sternness or severity.|severity,rigor|luxury,indulgence|GRE,GMAT
Autonomous|/ɔːˈtɒn.ə.məs/|adjective|Having self-government.|independent,sovereign|dependent,subordinate|GRE,GMAT
Avarice|/ˈæv.ər.ɪs/|noun|Extreme greed for wealth.|greed,cupidity|generosity,charity|GRE
Aver|/əˈvɜːr/|verb|State or assert to be the case.|assert,declare|deny,dispute|GRE
Banal|/bəˈnɑːl/|adjective|Lacking originality; trite.|trite,hackneyed|original,novel|GRE,GMAT
Belie|/bɪˈlaɪ/|verb|Fail to give a true impression.|contradict,mask|reveal,confirm|GRE
Beneficent|/bɪˈnef.ɪ.sənt/|adjective|Doing good; charitable.|benevolent,generous|malevolent,selfish|GRE
Bolster|/ˈbəʊl.stər/|verb|Support or strengthen.|reinforce,fortify|undermine,weaken|GRE,GMAT
Bombastic|/bɒmˈbæs.tɪk/|adjective|High-sounding but with little meaning.|pompous,ranting|understated,modest|GRE
Boorish|/ˈbʊə.rɪʃ/|adjective|Rough and bad-mannered.|crude,uncouth|refined,cultured|GRE
Burgeon|/ˈbɜː.dʒən/|verb|Begin to grow rapidly.|flourish,expand|shrink,wither|GRE
Burnish|/ˈbɜː.nɪʃ/|verb|Polish by rubbing; enhance.|polish,buff|tarnish,dull|GRE
Buttress|/ˈbʌt.rəs/|verb|Support or strengthen.|bolster,reinforce|undermine,weaken|GRE
Cacophony|/kəˈkɒf.ə.ni/|noun|A harsh mixture of sounds.|discord,dissonance|harmony,melody|GRE
Cajole|/kəˈdʒəʊl/|verb|Persuade with flattery.|coax,wheedle|dissuade,repel|GRE
Callous|/ˈkæl.əs/|adjective|Showing cruel disregard.|heartless,insensitive|compassionate,sensitive|GRE
Calumny|/ˈkæl.əm.ni/|noun|A false statement damaging reputation.|slander,defamation|praise,compliment|GRE
Candid|/ˈkæn.dɪd/|adjective|Truthful and straightforward.|frank,honest|deceptive,evasive|GRE,GMAT
Capricious|/kəˈprɪʃ.əs/|adjective|Given to sudden changes.|fickle,unpredictable|steady,constant|GRE
Castigate|/ˈkæs.tɪ.ɡeɪt/|verb|Reprimand severely.|berate,chastise|praise,commend|GRE
Catalyst|/ˈkæt.əl.ɪst/|noun|Something that provokes change.|stimulus,impetus|hindrance,deterrent|GRE,GMAT
Caustic|/ˈkɔː.stɪk/|adjective|Sarcastic in a scathing way.|biting,acerbic|mild,gentle|GRE
Censure|/ˈsen.ʃər/|verb|Express severe disapproval.|condemn,rebuke|praise,approve|GRE
Chicanery|/ʃɪˈkeɪ.nər.i/|noun|The use of trickery.|deception,subterfuge|honesty,frankness|GRE
Churlish|/ˈtʃɜː.lɪʃ/|adjective|Rude in a mean-spirited way.|surly,gruff|polite,courteous|GRE
Coalesce|/ˌkəʊ.əlˈes/|verb|Come together to form one.|merge,unite|separate,split|GRE,GMAT
Cogent|/ˈkəʊ.dʒənt/|adjective|Clear and convincing.|compelling,persuasive|weak,unconvincing|GRE
Commensurate|/kəˈmen.sər.ət/|adjective|Corresponding in size or degree.|proportionate,equivalent|disproportionate,unequal|GRE
Compendium|/kəmˈpen.di.əm/|noun|A collection of concise information.|compilation,summary|expansion,detail|GRE
Complacent|/kəmˈpleɪ.sənt/|adjective|Smugly self-satisfied.|smug,content|concerned,dissatisfied|GRE,GMAT
Conciliatory|/kənˈsɪl.i.ə.tər.i/|adjective|Intended to placate.|appeasing,pacifying|antagonistic,hostile|GRE
Condone|/kənˈdəʊn/|verb|Accept behavior that is wrong.|overlook,excuse|condemn,censure|GRE
Conflagration|/ˌkɒn.fləˈɡreɪ.ʃən/|noun|An extensive fire.|blaze,inferno|dousing,extinguishing|GRE
Connoisseur|/ˌkɒn.əˈsɜːr/|noun|An expert judge in matters of taste.|expert,aficionado|novice,amateur|GRE
Conspicuous|/kənˈspɪk.ju.əs/|adjective|Standing out so as to be noticed.|noticeable,prominent|hidden,inconspicuous|GRE,GMAT
Contrive|/kənˈtraɪv/|verb|Create in a skillful way.|devise,engineer|destroy,dismantle|GRE
Copious|/ˈkəʊ.pi.əs/|adjective|Abundant in supply or quantity.|abundant,plentiful|sparse,scant|GRE
Cosmopolitan|/ˌkɒz.məˈpɒl.ə.tən/|adjective|Familiar with many cultures.|worldly,sophisticated|provincial,insular|GRE,IELTS
Credulous|/ˈkredʒ.ə.ləs/|adjective|Too ready to believe.|gullible,naive|skeptical,discerning|GRE
Cursory|/ˈkɜː.sər.i/|adjective|Hasty and not thorough.|superficial,perfunctory|thorough,detailed|GRE,GMAT
Cynical|/ˈsɪn.ɪ.kəl/|adjective|Believing people are motivated by self-interest.|skeptical,distrustful|trusting,idealistic|GRE,GMAT
Debilitate|/dɪˈbɪl.ɪ.teɪt/|verb|Make weak or infirm.|weaken,enfeeble|strengthen,invigorate|GRE
Decorum|/dɪˈkɔː.rəm/|noun|Behavior in keeping with good taste.|propriety,etiquette|impropriety,rudeness|GRE
Deference|/ˈdef.ər.əns/|noun|Humble submission and respect.|respect,reverence|disrespect,contempt|GRE
Delineate|/dɪˈlɪn.i.eɪt/|verb|Describe precisely.|outline,sketch|confuse,obscure|GRE
Demur|/dɪˈmɜːr/|verb|Raise doubts or objections.|object,protest|accept,agree|GRE
Denigrate|/ˈden.ɪ.ɡreɪt/|verb|Criticize unfairly.|disparage,belittle|praise,extol|GRE
Deride|/dɪˈraɪd/|verb|Express contempt for.|mock,ridicule|praise,admire|GRE
Desiccate|/ˈdes.ɪ.keɪt/|verb|Remove moisture from.|dry,dehydrate|moisten,hydrate|GRE
Desultory|/ˈdes.əl.tər.i/|adjective|Lacking a plan or enthusiasm.|random,aimless|methodical,focused|GRE
Deterrent|/dɪˈter.ənt/|noun|A thing that discourages action.|discouragement,hindrance|incentive,encouragement|GRE
Diatribe|/ˈdaɪ.ə.traɪb/|noun|A forceful verbal attack.|tirade,harangue|praise,tribute|GRE
Dichotomy|/daɪˈkɒt.ə.mi/|noun|A division into two opposed parts.|division,split|unity,whole|GRE,GMAT
Diffident|/ˈdɪf.ɪ.dənt/|adjective|Modest because of lack of confidence.|shy,timid|confident,bold|GRE
Dilatory|/ˈdɪl.ə.tər.i/|adjective|Slow to act.|slow,tardy|prompt,punctual|GRE
Dilettante|/ˌdɪl.əˈtænt/|noun|A dabbler in a field.|amateur,dabbler|expert,professional|GRE
Dirge|/dɜːdʒ/|noun|A lament for the dead.|elegy,requiem|celebration,anthem|GRE
Disabuse|/ˌdɪs.əˈbjuːz/|verb|Persuade someone that an idea is mistaken.|correct,enlighten|mislead,deceive|GRE
Discerning|/dɪˈsɜː.nɪŋ/|adjective|Having good judgment.|perceptive,astute|undiscerning,obtuse|GRE
Disparate|/ˈdɪs.pər.ət/|adjective|Essentially different in kind.|dissimilar,divergent|similar,alike|GRE,GMAT
Dissemble|/dɪˈsem.bəl/|verb|Conceal one's true motives.|pretend,feign|reveal,expose|GRE
Disseminate|/dɪˈsem.ɪ.neɪt/|verb|Spread widely.|distribute,circulate|withhold,suppress|GRE
Dissolution|/ˌdɪs.əˈluː.ʃən/|noun|The closing down of something.|termination,dissolving|formation,establishment|GRE
Distend|/dɪˈstend/|verb|Swell by pressure from inside.|expand,bloat|contract,compress|GRE
Dogmatic|/dɒɡˈmæt.ɪk/|adjective|Inclined to lay down principles as true.|opinionated,doctrinaire|open-minded,flexible|GRE
Dormant|/ˈdɔː.mənt/|adjective|Having normal physical functions suspended.|inactive,latent|active,awake|GRE,GMAT
Duplicity|/djuːˈplɪs.ə.ti/|noun|Deceitfulness; double-dealing.|deception,deceit|honesty,sincerity|GRE
Ebullient|/ɪˈbʌl.i.ənt/|adjective|Cheerful and full of energy.|exuberant,enthusiastic|gloomy,depressed|GRE
Eclectic|/ɪˈklek.tɪk/|adjective|Deriving ideas from a broad range.|diverse,varied|narrow,uniform|GRE
Efficacy|/ˈef.ɪ.kə.si/|noun|The ability to produce a result.|effectiveness,potency|ineffectiveness,weakness|GRE,GMAT
Effrontery|/ɪˈfrʌn.tər.i/|noun|Insolent or impertinent behavior.|audacity,nerve|timidity,modesty|GRE
Egalitarian|/ɪˌɡæl.ɪˈteə.ri.ən/|adjective|Believing all people are equal.|equalitarian,fair|elitist,hierarchical|GRE
Elegy|/ˈel.ə.dʒi/|noun|A poem of serious reflection.|lament,dirge|celebration,ode|GRE
Elicit|/ɪˈlɪs.ɪt/|verb|Evoke or draw out a response.|extract,draw out|suppress,repress|GRE,GMAT
Embellish|/ɪmˈbel.ɪʃ/|verb|Make more attractive; exaggerate.|adorn,decorate|strip,simplify|GRE
Empirical|/ɪmˈpɪr.ɪ.kəl/|adjective|Based on observation or experience.|observed,experimental|theoretical,hypothetical|GRE,GMAT
Emulate|/ˈem.jə.leɪt/|verb|Match or surpass by imitation.|imitate,mimic|neglect,ignore|GRE
Enervate|/ˈen.ə.veɪt/|verb|Cause to feel drained of energy.|weaken,exhaust|invigorate,energize|GRE
Engender|/ɪnˈdʒen.dər/|verb|Cause or give rise to.|produce,generate|prevent,destroy|GRE
Enhance|/ɪnˈhɑːns/|verb|Intensify or improve quality.|improve,boost|diminish,reduce|GRE,IELTS
Enigma|/ɪˈnɪɡ.mə/|noun|A person or thing that is mysterious.|puzzle,riddle|explanation,certainty|GRE
Epitome|/ɪˈpɪt.ə.mi/|noun|A perfect example of a quality.|embodiment,archetype|opposite,antithesis|GRE,GMAT
Equanimity|/ˌek.wəˈnɪm.ə.ti/|noun|Mental calmness and composure.|composure,poise|agitation,anxiety|GRE
Equivocate|/ɪˈkwɪv.ə.keɪt/|verb|Use ambiguous language to conceal truth.|prevaricate,hedge|clarify,declare|GRE
Erudite|/ˈer.ʊ.daɪt/|adjective|Having great knowledge.|learned,scholarly|ignorant,uneducated|GRE
Esoteric|/ˌes.əˈter.ɪk/|adjective|Intended for a small group.|obscure,arcane|common,popular|GRE
Eulogy|/ˈjuː.lə.dʒi/|noun|A speech praising someone who died.|tribute,panegyric|criticism,denunciation|GRE
Euphemism|/ˈjuː.fə.mɪ.zəm/|noun|A mild word substituting for a harsh one.|understatement,politeness|dysphemism,bluntness|GRE
Exacerbate|/ɪɡˈzæs.ə.beɪt/|verb|Make a problem worse.|worsen,aggravate|alleviate,improve|GRE,GMAT
Exculpate|/ˈeks.kʌl.peɪt/|verb|Show or declare not guilty.|absolve,exonerate|incriminate,blame|GRE
Exigent|/ˈek.sɪ.dʒənt/|adjective|Requiring immediate action.|urgent,pressing|unimportant,trivial|GRE
Exonerate|/ɪɡˈzɒn.ə.reɪt/|verb|Absolve from blame.|vindicate,acquit|convict,blame|GRE
Expedient|/ɪkˈspiː.di.ənt/|adjective|Convenient though possibly improper.|pragmatic,advantageous|inconvenient,idealistic|GRE
Expunge|/ɪkˈspʌndʒ/|verb|Erase or remove completely.|delete,erase|add,insert|GRE
Extant|/ekˈstænt/|adjective|Still in existence.|existing,surviving|extinct,dead|GRE
Extol|/ɪkˈstəʊl/|verb|Praise enthusiastically.|laud,acclaim|criticize,condemn|GRE
Extraneous|/ɪkˈstreɪ.ni.əs/|adjective|Irrelevant to the subject.|irrelevant,superfluous|relevant,essential|GRE,GMAT
Extricate|/ˈeks.trɪ.keɪt/|verb|Free from a constraint.|disentangle,liberate|entangle,imprison|GRE
Exuberant|/ɪɡˈzuː.bər.ənt/|adjective|Filled with lively energy.|ebullient,enthusiastic|gloomy,depressed|GRE
Facetious|/fəˈsiː.ʃəs/|adjective|Treating serious issues with humor.|flippant,playful|serious,somber|GRE
Facilitate|/fəˈsɪl.ɪ.teɪt/|verb|Make an action easier.|ease,enable|hinder,impede|GRE,GMAT
Fallacious|/fəˈleɪ.ʃəs/|adjective|Based on a mistaken belief.|false,flawed|valid,sound|GRE
Fatuous|/ˈfætʃ.u.əs/|adjective|Silly and pointless.|foolish,inane|sensible,wise|GRE
Fawning|/ˈfɔː.nɪŋ/|adjective|Excessively complimentary.|obsequious,servile|assertive,dominant|GRE
Felicitous|/fɪˈlɪs.ɪ.təs/|adjective|Well chosen or suited.|apt,appropriate|inappropriate,awkward|GRE
Fervid|/ˈfɜː.vɪd/|adjective|Intensely enthusiastic.|passionate,ardent|apathetic,indifferent|GRE
Flag|/flæɡ/|verb|Become tired or less enthusiastic.|wane,decline|strengthen,flourish|GRE
Fledgling|/ˈfledʒ.lɪŋ/|noun|A person new to an activity.|novice,beginner|expert,veteran|GRE,GMAT
Florid|/ˈflɒr.ɪd/|adjective|Excessively elaborate.|ornate,flowery|plain,austere|GRE
Flout|/flaʊt/|verb|Openly disregard a rule.|defy,scorn|obey,respect|GRE
Foment|/fəˈment/|verb|Instigate or stir up trouble.|incite,provoke|suppress,discourage|GRE
Forestall|/fɔːˈstɔːl/|verb|Prevent by taking action first.|preempt,thwart|allow,permit|GRE
Frugal|/ˈfruː.ɡəl/|adjective|Sparing with money or resources.|thrifty,economical|wasteful,extravagant|GRE,GMAT
Futile|/ˈfjuː.taɪl/|adjective|Incapable of producing results.|pointless,useless|effective,fruitful|GRE,IELTS
Gainsay|/ˌɡeɪnˈseɪ/|verb|Deny or contradict.|contradict,dispute|admit,confirm|GRE
Garrulous|/ˈɡær.ʊ.ləs/|adjective|Excessively talkative.|loquacious,verbose|taciturn,reserved|GRE
Goad|/ɡəʊd/|verb|Provoke to stimulate action.|spur,prod|deter,discourage|GRE
Gourmand|/ˈɡʊə.mɑːnd/|noun|A person who enjoys fine food.|epicure,glutton|ascetic,abstainer|GRE
Grandiloquent|/ɡrænˈdɪl.ə.kwənt/|adjective|Pompous in style.|pompous,bombastic|plain,modest|GRE
Gregarious|/ɡrɪˈɡeə.ri.əs/|adjective|Fond of company.|sociable,outgoing|antisocial,reclusive|GRE
Guileless|/ˈɡaɪl.ləs/|adjective|Devoid of deceit.|innocent,naive|cunning,crafty|GRE
Gullible|/ˈɡʌl.ɪ.bəl/|adjective|Easily persuaded to believe.|credulous,naive|skeptical,discerning|GRE
Hackneyed|/ˈhæk.nid/|adjective|Lacking significance through overuse.|trite,banal|fresh,original|GRE
Halcyon|/ˈhæl.si.ən/|adjective|Denoting a peaceful golden time.|peaceful,serene|turbulent,chaotic|GRE
Harangue|/həˈræŋ/|noun|A lengthy aggressive speech.|tirade,diatribe|conversation,dialogue|GRE
Hegemony|/hɪˈɡem.ə.ni/|noun|Leadership or dominance.|dominance,supremacy|subordination,weakness|GRE
Heresy|/ˈher.ə.si/|noun|Belief contrary to orthodox doctrine.|dissent,nonconformity|orthodoxy,conformity|GRE
Iconoclast|/aɪˈkɒn.ə.klæst/|noun|A person who attacks beliefs.|rebel,dissenter|conformist,traditionalist|GRE
Idiosyncrasy|/ˌɪd.i.əˈsɪŋ.krə.si/|noun|A mode of behavior peculiar to an individual.|quirk,eccentricity|normality,convention|GRE
Ignominious|/ˌɪɡ.nəˈmɪn.i.əs/|adjective|Deserving public disgrace.|shameful,humiliating|honorable,glorious|GRE
Imminent|/ˈɪm.ɪ.nənt/|adjective|About to happen.|impending,approaching|distant,remote|GRE,GMAT
Immutable|/ɪˈmjuː.tə.bəl/|adjective|Unchanging over time.|fixed,constant|changeable,variable|GRE
Impartial|/ɪmˈpɑː.ʃəl/|adjective|Treating all rivals equally.|fair,unbiased|biased,partial|GRE,IELTS
Impecunious|/ˌɪm.pɪˈkjuː.ni.əs/|adjective|Having little money.|poor,penniless|wealthy,affluent|GRE
Imperious|/ɪmˈpɪə.ri.əs/|adjective|Assuming power without justification.|domineering,overbearing|submissive,humble|GRE
Imperturbable|/ˌɪm.pəˈtɜː.bə.bəl/|adjective|Unable to be upset.|composed,unflappable|agitated,nervous|GRE
Impetuous|/ɪmˈpetʃ.u.əs/|adjective|Acting quickly without thought.|impulsive,rash|cautious,deliberate|GRE
Implacable|/ɪmˈplæk.ə.bəl/|adjective|Unable to be placated.|relentless,unforgiving|forgiving,merciful|GRE
Implicit|/ɪmˈplɪs.ɪt/|adjective|Implied though not stated.|implied,unspoken|explicit,stated|GRE,GMAT
Inadvertent|/ˌɪn.ədˈvɜː.tənt/|adjective|Not resulting from deliberate planning.|accidental,unintentional|intentional,deliberate|GRE
Inchoate|/ɪnˈkəʊ.eɪt/|adjective|Just begun and not fully formed.|rudimentary,embryonic|developed,mature|GRE
Incumbent|/ɪnˈkʌm.bənt/|adjective|Necessary as a duty.|obligatory,mandatory|unnecessary,optional|GRE,GMAT
Indefatigable|/ˌɪn.dɪˈfæt.ɪ.ɡə.bəl/|adjective|Persisting tirelessly.|tireless,unwavering|lethargic,weary|GRE
Indigenous|/ɪnˈdɪdʒ.ɪ.nəs/|adjective|Originating naturally in a place.|native,local|foreign,imported|GRE,IELTS
Indolent|/ˈɪn.də.lənt/|adjective|Wanting to avoid activity.|lazy,slothful|industrious,energetic|GRE
Ineffable|/ɪnˈef.ə.bəl/|adjective|Too great to be expressed in words.|indescribable,transcendent|describable,expressible|GRE
Inexorable|/ɪnˈeks.ər.ə.bəl/|adjective|Impossible to stop or prevent.|relentless,unstoppable|flexible,yielding|GRE
Ingenuous|/ɪnˈdʒen.ju.əs/|adjective|Innocent and unsuspecting.|naive,sincere|cunning,worldly|GRE
Inimical|/ɪˈnɪm.ɪ.kəl/|adjective|Tending to obstruct or harm.|hostile,harmful|friendly,beneficial|GRE
Innocuous|/ɪˈnɒk.ju.əs/|adjective|Not harmful or offensive.|harmless,benign|harmful,offensive|GRE
Insipid|/ɪnˈsɪp.ɪd/|adjective|Lacking flavor or interest.|bland,dull|flavorful,exciting|GRE
Insular|/ˈɪn.sjə.lər/|adjective|Ignorant of cultures outside one's own.|narrow-minded,provincial|cosmopolitan,open|GRE
Invective|/ɪnˈvek.tɪv/|noun|Insulting or abusive language.|abuse,denunciation|praise,flattery|GRE
Inveterate|/ɪnˈvet.ər.ət/|adjective|Having a habit unlikely to change.|habitual,chronic|occasional,infrequent|GRE
Irascible|/ɪˈræs.ɪ.bəl/|adjective|Having a tendency to be angry.|irritable,testy|calm,placid|GRE
Lacuna|/ləˈkjuː.nə/|noun|An unfilled gap.|gap,void|continuity,fullness|GRE
Lambaste|/læmˈbeɪst/|verb|Criticize harshly.|berate,castigate|praise,commend|GRE
Languid|/ˈlæŋ.ɡwɪd/|adjective|Slow and relaxed.|lethargic,listless|energetic,vigorous|GRE
Largess|/lɑːˈʒes/|noun|Generosity in giving.|generosity,bounty|stinginess,meanness|GRE
Latent|/ˈleɪ.tənt/|adjective|Existing but not yet developed.|dormant,potential|active,obvious|GRE,GMAT
Laudable|/ˈlɔː.də.bəl/|adjective|Deserving praise.|praiseworthy,commendable|shameful,deplorable|GRE
Lethargic|/ləˈθɑː.dʒɪk/|adjective|Sluggish and apathetic.|sluggish,torpid|energetic,active|GRE
Levity|/ˈlev.ə.ti/|noun|Humor or frivolity.|frivolity,lightness|seriousness,gravity|GRE
Logistical|/ləˈdʒɪs.tɪ.kəl/|adjective|Relating to organization of a complex operation.|organizational,operational|disorganized,chaotic|GRE,GMAT
Longevity|/lɒnˈdʒev.ə.ti/|noun|Long existence of something.|durability,endurance|brevity,transience|GRE,GMAT
Lucid|/ˈluː.sɪd/|adjective|Expressed clearly; easy to understand.|clear,coherent|confusing,unclear|GRE
Luminous|/ˈluː.mɪ.nəs/|adjective|Full of light; bright.|radiant,glowing|dim,dark|GRE
Magnanimous|/mæɡˈnæn.ɪ.məs/|adjective|Generous in forgiving.|noble,forgiving|petty,vindictive|GRE
Malediction|/ˌmæl.ɪˈdɪk.ʃən/|noun|A magical word of curse.|curse,imprecation|blessing,benediction|GRE
Malleable|/ˈmæl.i.ə.bəl/|adjective|Easily influenced.|pliable,impressionable|rigid,inflexible|GRE,GMAT
Maverick|/ˈmæv.ər.ɪk/|noun|An unorthodox person.|nonconformist,rebel|conformist,traditionalist|GRE,GMAT
Mawkish|/ˈmɔː.kɪʃ/|adjective|Sentimental in a feeble way.|sentimental,saccharine|unsentimental,realistic|GRE
Meticulous|/məˈtɪk.jə.ləs/|adjective|Showing great attention to detail.|careful,precise|careless,sloppy|GRE,IELTS
Misanthrope|/ˈmɪs.ən.θrəʊp/|noun|A person who dislikes humankind.|cynic,recluse|philanthropist,altruist|GRE
Mitigate|/ˈmɪt.ɪ.ɡeɪt/|verb|Make less severe or serious.|alleviate,reduce|aggravate,worsen|GRE,GMAT
Modicum|/ˈmɒd.ɪ.kəm/|noun|A small quantity of something.|bit,trace|abundance,lot|GRE
Morose|/məˈrəʊs/|adjective|Sullen and ill-tempered.|gloomy,sulky|cheerful,upbeat|GRE
Mundane|/mʌnˈdeɪn/|adjective|Lacking interest; ordinary.|ordinary,routine|extraordinary,exciting|GRE
Myriad|/ˈmɪr.i.əd/|noun|A countless or extremely great number.|multitude,host|few,handful|GRE,GMAT
Negligent|/ˈneɡ.lɪ.dʒənt/|adjective|Failing to take proper care.|careless,remiss|careful,diligent|GRE
Neophyte|/ˈniː.ə.faɪt/|noun|A person new to a subject.|novice,beginner|expert,veteran|GRE
Noisome|/ˈnɔɪ.səm/|adjective|Having an extremely offensive smell.|foul,putrid|fragrant,pleasant|GRE
Nonchalant|/ˈnɒn.ʃə.lɒnt/|adjective|Feeling casually calm.|casual,unconcerned|anxious,concerned|GRE
Novice|/ˈnɒv.ɪs/|noun|A person new to a field.|beginner,tyro|expert,master|GRE,IELTS
Obdurate|/ˈɒb.dʒər.ət/|adjective|Stubbornly refusing to change.|stubborn,inflexible|flexible,yielding|GRE
Obsequious|/əbˈsiː.kwi.əs/|adjective|Obedient to an excessive degree.|servile,sycophantic|assertive,dominant|GRE
Obviate|/ˈɒb.vi.eɪt/|verb|Remove a need or difficulty.|preclude,prevent|necessitate,cause|GRE
Onerous|/ˈəʊ.nər.əs/|adjective|Involving great effort.|burdensome,arduous|easy,effortless|GRE
Opprobrium|/əˈprəʊ.bri.əm/|noun|Harsh criticism or censure.|disgrace,infamy|praise,honor|GRE
Oscillate|/ˈɒs.ɪ.leɪt/|verb|Move back and forth.|fluctuate,vacillate|stabilize,steady|GRE
Ostentatious|/ˌɒs.tenˈteɪ.ʃəs/|adjective|Characterized by showy display.|flamboyant,pretentious|modest,understated|GRE
Paragon|/ˈpær.ə.ɡən/|noun|A person or thing regarded as perfect.|model,ideal|flaw,imperfection|GRE
Pariah|/pəˈraɪ.ə/|noun|An outcast.|outcast,exile|insider,celebrity|GRE
Parsimonious|/ˌpɑː.sɪˈməʊ.ni.əs/|adjective|Unwilling to spend money.|stingy,frugal|generous,lavish|GRE
Paucity|/ˈpɔː.sə.ti/|noun|The presence of something in small amount.|scarcity,dearth|abundance,surplus|GRE
Pedantic|/pɪˈdæn.tɪk/|adjective|Excessively concerned with minor rules.|nitpicking,bookish|informal,casual|GRE
Penchant|/ˈpɒŋ.ʃɒŋ/|noun|A strong liking.|fondness,affinity|dislike,aversion|GRE
Penury|/ˈpen.jər.i/|noun|The state of being very poor.|poverty,destitution|wealth,affluence|GRE
Perfunctory|/pəˈfʌŋk.tər.i/|adjective|Carried out with minimal effort.|cursory,superficial|thorough,careful|GRE
Permeate|/ˈpɜː.mi.eɪt/|verb|Spread throughout.|pervade,saturate|block,contain|GRE,GMAT
Pertinent|/ˈpɜː.tɪ.nənt/|adjective|Relevant to a particular matter.|relevant,applicable|irrelevant,immaterial|GRE,IELTS
Peruse|/pəˈruːz/|verb|Read thoroughly.|examine,scrutinize|skim,glance|GRE
Pervasive|/pəˈveɪ.sɪv/|adjective|Spreading widely throughout.|widespread,ubiquitous|limited,rare|GRE,GMAT
Phlegmatic|/fleɡˈmæt.ɪk/|adjective|Having an unemotional disposition.|calm,stoic|emotional,excitable|GRE
Piety|/ˈpaɪ.ə.ti/|noun|The quality of being religious.|devotion,reverence|impiety,irreverence|GRE
Placate|/pləˈkeɪt/|verb|Make less angry.|appease,pacify|provoke,anger|GRE
Plasticity|/plæˈstɪs.ə.ti/|noun|Adaptability to change.|flexibility,malleability|rigidity,inflexibility|GRE
Platitude|/ˈplæt.ɪ.tjuːd/|noun|A remark that is overused.|cliche,truism|originality,novelty|GRE
Plausible|/ˈplɔː.zə.bəl/|adjective|Seeming reasonable or probable.|credible,believable|unlikely,implausible|GRE,GMAT
Plethora|/ˈpleθ.ər.ə/|noun|A large or excessive amount.|excess,surplus|scarcity,lack|GRE
Pragmatic|/præɡˈmæt.ɪk/|adjective|Dealing with things practically.|practical,realistic|idealistic,impractical|GRE,GMAT
Precarious|/prɪˈkeə.ri.əs/|adjective|Not securely held; risky.|uncertain,unstable|secure,stable|GRE
Precipitate|/prɪˈsɪp.ɪ.teɪt/|verb|Cause to happen suddenly.|hasten,trigger|delay,hinder|GRE
Preclude|/prɪˈkluːd/|verb|Prevent from happening.|prevent,obviate|allow,permit|GRE
Precursor|/priːˈkɜː.sər/|noun|A person or thing that comes before.|forerunner,predecessor|successor,descendant|GRE
Predilection|/ˌpred.ɪˈlek.ʃən/|noun|A preference.|fondness,penchant|aversion,dislike|GRE
Prevaricate|/prɪˈvær.ɪ.keɪt/|verb|Speak evasively.|equivocate,hedge|clarify,declare|GRE
Probity|/ˈprəʊ.bə.ti/|noun|The quality of having strong moral principles.|integrity,honesty|dishonesty,corruption|GRE
Proclivity|/prəˈklɪv.ə.ti/|noun|A tendency to choose or do something.|inclination,propensity|aversion,disinclination|GRE
Prodigal|/ˈprɒd.ɪ.ɡəl/|adjective|Spending money freely.|wasteful,extravagant|frugal,thrifty|GRE
Profound|/prəˈfaʊnd/|adjective|Very great or intense.|deep,intense|superficial,shallow|GRE,IELTS
Proliferate|/prəˈlɪf.ə.reɪt/|verb|Increase rapidly in number.|multiply,spread|decrease,diminish|GRE,GMAT
Propensity|/prəˈpen.sə.ti/|noun|An inclination toward something.|tendency,inclination|aversion,disinclination|GRE
Propitiate|/prəˈpɪʃ.ieɪt/|verb|Win favor by doing something pleasing.|appease,conciliate|anger,provoke|GRE
Propriety|/prəˈpraɪ.ə.ti/|noun|Conformity to conventionally accepted standards.|decorum,decency|impropriety,indecency|GRE
Proscribe|/prəʊˈskraɪb/|verb|Forbid or condemn.|ban,prohibit|allow,permit|GRE
Pungent|/ˈpʌn.dʒənt/|adjective|Having a sharply strong taste or smell.|sharp,biting|mild,bland|GRE
Quiescent|/kwiˈes.ənt/|adjective|In a state of inactivity.|dormant,inactive|active,busy|GRE
Quixotic|/kwɪkˈsɒt.ɪk/|adjective|Exceedingly idealistic.|impractical,romantic|realistic,practical|GRE
Quotidian|/kwəʊˈtɪd.i.ən/|adjective|Of or occurring every day.|daily,routine|unusual,extraordinary|GRE
Recalcitrant|/rɪˈkæl.sɪ.trənt/|adjective|Having an obstinately uncooperative attitude.|defiant,stubborn|compliant,obedient|GRE
Recant|/rɪˈkænt/|verb|Withdraw a statement or belief.|retract,disavow|affirm,maintain|GRE
Recluse|/rɪˈkluːs/|noun|A person who lives alone.|hermit,loner|socialite,extrovert|GRE
Relegate|/ˈrel.ɪ.ɡeɪt/|verb|Assign to a lower position.|demote,banish|promote,elevate|GRE
Remonstrate|/ˈrem.ən.streɪt/|verb|Make a forcefully reproachful protest.|protest,object|agree,accept|GRE
Replete|/rɪˈpliːt/|adjective|Filled or well supplied.|full,stuffed|empty,devoid|GRE
Reprobate|/ˈrep.rə.beɪt/|noun|An unprincipled person.|scoundrel,villain|saint,paragon|GRE
Repudiate|/rɪˈpjuː.di.eɪt/|verb|Refuse to accept or be associated with.|reject,deny|accept,embrace|GRE
Resilient|/rɪˈzɪl.i.ənt/|adjective|Able to recover quickly.|tough,flexible|fragile,weak|GRE,IELTS
Resolute|/ˈrez.ə.luːt/|adjective|Admirably purposeful and determined.|determined,firm|hesitant,uncertain|GRE
Reticent|/ˈret.ɪ.sənt/|adjective|Not revealing one's thoughts readily.|reserved,quiet|talkative,forthcoming|GRE
Reverent|/ˈrev.ər.ənt/|adjective|Feeling deep respect.|respectful,devout|disrespectful,irreverent|GRE
Rhetoric|/ˈret.ər.ɪk/|noun|The art of effective speaking.|oratory,eloquence|silence,quiet|GRE,IELTS
Rudimentary|/ˌruː.dɪˈmen.tər.i/|adjective|Involving basic principles.|basic,elementary|advanced,sophisticated|GRE
Sagacious|/səˈɡeɪ.ʃəs/|adjective|Having good judgment.|wise,shrewd|foolish,unwise|GRE
Salient|/ˈseɪ.li.ənt/|adjective|Most noticeable or important.|prominent,notable|insignificant,minor|GRE,GMAT
Sanction|/ˈsæŋk.ʃən/|noun|Official permission or penalty.|authorization,penalty|prohibition,ban|GRE
Sardonic|/sɑːˈdɒn.ɪk/|adjective|Grimly mocking or cynical.|sarcastic,mordant|sincere,earnest|GRE
Satiate|/ˈseɪ.ʃieɪt/|verb|Fill to satisfaction.|satisfy,sate|starve,deprive|GRE
Scintillating|/ˈsɪn.tɪ.leɪ.tɪŋ/|adjective|Sparkling or brilliantly clever.|dazzling,stimulating|dull,boring|GRE
Scrupulous|/ˈskruː.pjə.ləs/|adjective|Diligent and thorough.|meticulous,careful|careless,negligent|GRE
Scrutinize|/ˈskruː.tɪ.naɪz/|verb|Examine closely.|inspect,analyze|glance,overlook|GRE,IELTS
Sedentary|/ˈsed.ən.tər.i/|adjective|Characterized by much sitting.|inactive,stationary|active,mobile|GRE
Seminal|/ˈsem.ɪ.nəl/|adjective|Strongly influencing later developments.|influential,groundbreaking|insignificant,minor|GRE
Servile|/ˈsɜː.vaɪl/|adjective|Having the qualities of a slave.|submissive,obsequious|dominant,assertive|GRE
Skeptical|/ˈskep.tɪ.kəl/|adjective|Not easily convinced.|doubtful,dubious|trusting,credulous|GRE,GMAT
Solicitous|/səˈlɪs.ɪ.təs/|adjective|Showing interest or concern.|attentive,caring|indifferent,uncaring|GRE
Soporific|/ˌsɒp.ərˈɪf.ɪk/|adjective|Tending to induce drowsiness.|sleepy,drowsy|stimulating,energizing|GRE
Specious|/ˈspiː.ʃəs/|adjective|Superficially plausible but wrong.|misleading,deceptive|valid,genuine|GRE
Spurious|/ˈspjʊə.ri.əs/|adjective|Not being what it purports to be.|false,bogus|genuine,authentic|GRE
Stolid|/ˈstɒl.ɪd/|adjective|Calm and showing little emotion.|impassive,unemotional|emotional,expressive|GRE
Strenuous|/ˈstren.ju.əs/|adjective|Requiring great effort.|arduous,laborious|easy,effortless|GRE
Strident|/ˈstraɪ.dənt/|adjective|Loud and harsh.|shrill,grating|soft,mellow|GRE
Stupefy|/ˈstjuː.pɪ.faɪ/|verb|Make unable to think clearly.|daze,bewilder|enlighten,clarify|GRE
Subpoena|/səˈpiː.nə/|noun|A writ ordering appearance in court.|summons,citation|dismissal,release|GRE
Substantiate|/səbˈstæn.ʃieɪt/|verb|Provide evidence to support.|verify,confirm|disprove,refute|GRE
Subversive|/səbˈvɜː.sɪv/|adjective|Seeking to undermine an established system.|disruptive,rebellious|conformist,loyal|GRE
Succinct|/səkˈsɪŋkt/|adjective|Briefly and clearly expressed.|concise,brief|verbose,wordy|GRE,GMAT
Superfluous|/suːˈpɜː.flu.əs/|adjective|Unnecessary through being more than enough.|excess,redundant|essential,necessary|GRE
Surfeit|/ˈsɜː.fɪt/|noun|An excessive amount.|excess,surplus|lack,deficiency|GRE
Surreptitious|/ˌsʌr.əpˈtɪʃ.əs/|adjective|Kept secret because it would not be approved.|secret,stealthy|open,overt|GRE
Sycophant|/ˈsɪk.ə.fænt/|noun|A person who acts obsequiously.|flatterer,toady|critic,opponent|GRE
Taciturn|/ˈtæs.ɪ.tɜːn/|adjective|Reserved or uncommunicative in speech.|quiet,reticent|talkative,loquacious|GRE
Tantamount|/ˈtæn.tə.maʊnt/|adjective|Equivalent in seriousness.|equivalent,equal|different,dissimilar|GRE
Temerity|/təˈmer.ə.ti/|noun|Excessive confidence or boldness.|audacity,nerve|caution,care|GRE
Temperance|/ˈtem.pər.əns/|noun|Moderation or self-restraint.|moderation,restraint|excess,indulgence|GRE
Tenacious|/təˈneɪ.ʃəs/|adjective|Tending to keep a firm hold.|persistent,determined|yielding,weak|GRE,GMAT
Tenuous|/ˈten.ju.əs/|adjective|Very weak or slight.|weak,fragile|strong,solid|GRE
Terse|/tɜːs/|adjective|Sparing in the use of words.|brief,concise|verbose,wordy|GRE
Timorous|/ˈtɪm.ər.əs/|adjective|Showing nervousness.|fearful,timid|bold,confident|GRE
Tirade|/taɪˈreɪd/|noun|A long angry speech.|rant,harangue|praise,compliment|GRE
Torpor|/ˈtɔː.pər/|noun|A state of physical inactivity.|lethargy,sluggishness|energy,vigor|GRE
Tortuous|/ˈtɔː.tʃu.əs/|adjective|Full of twists; complex.|winding,convoluted|straight,simple|GRE
Tractable|/ˈtræk.tə.bəl/|adjective|Easy to control.|manageable,docile|stubborn,unmanageable|GRE
Tranquil|/ˈtræŋ.kwɪl/|adjective|Free from disturbance.|peaceful,calm|agitated,stormy|GRE,IELTS
Transgress|/trænzˈɡres/|verb|Offend against a law or rule.|violate,infringe|obey,comply|GRE
Transient|/ˈtræn.ʃi.ənt/|adjective|Lasting only for a short time.|temporary,fleeting|permanent,lasting|GRE
Ubiquitous|/juːˈbɪk.wɪ.təs/|adjective|Present everywhere.|omnipresent,pervasive|rare,scarce|GRE,GMAT
Undermine|/ˌʌn.dəˈmaɪn/|verb|Erode the base or foundation.|weaken,sabotage|strengthen,support|GRE,IELTS
Undulate|/ˈʌn.dʒə.leɪt/|verb|Move with a smooth wavelike motion.|ripple,wave|stabilize,flatten|GRE
Urbane|/ɜːˈbeɪn/|adjective|Courteous and refined.|suave,sophisticated|rude,uncouth|GRE
Usurp|/juːˈzɜːp/|verb|Take a position of power illegally.|seize,commandeer|relinquish,surrender|GRE
Vacillate|/ˈvæs.ɪ.leɪt/|verb|Alternate between opinions.|waver,hesitate|decide,resolve|GRE
Vacuous|/ˈvæk.ju.əs/|adjective|Having no content; empty.|empty,void|full,meaningful|GRE
Venerate|/ˈven.ər.eɪt/|verb|Regard with great respect.|revere,honor|despise,disrespect|GRE
Veracious|/vəˈreɪ.ʃəs/|adjective|Speaking the truth.|truthful,honest|dishonest,lying|GRE
Verbose|/vɜːˈbəʊs/|adjective|Using more words than needed.|wordy,prolix|concise,brief|GRE
Viable|/ˈvaɪ.ə.bəl/|adjective|Capable of working successfully.|feasible,workable|impossible,unworkable|GRE,GMAT
Vicarious|/vɪˈkeə.ri.əs/|adjective|Experienced through another person.|indirect,secondhand|direct,personal|GRE
Vilify|/ˈvɪl.ɪ.faɪ/|verb|Speak or write about in an abusively disparaging manner.|defame,malign|praise,extol|GRE
Vindicate|/ˈvɪn.dɪ.keɪt/|verb|Clear of blame or suspicion.|exonerate,absolve|blame,condemn|GRE
Virtuoso|/ˌvɜː.tʃuˈəʊ.səʊ/|noun|A person highly skilled in music or art.|expert,master|amateur,novice|GRE
Visceral|/ˈvɪs.ər.əl/|adjective|Relating to deep inward feelings.|instinctive,gut|intellectual,cerebral|GRE
Vituperate|/vɪˈtjuː.pər.eɪt/|verb|Blame or insult someone.|berate,revile|praise,compliment|GRE
Volatile|/ˈvɒl.ə.taɪl/|adjective|Liable to change rapidly.|unstable,erratic|stable,steady|GRE,GMAT
Voracious|/vəˈreɪ.ʃəs/|adjective|Wanting great quantities.|insatiable,ravenous|moderate,satisfied|GRE
Wary|/ˈweə.ri/|adjective|Feeling caution about dangers.|cautious,careful|careless,reckless|GRE,IELTS
Whimsical|/ˈwɪm.zɪ.kəl/|adjective|Playfully quaint.|fanciful,quirky|serious,practical|GRE
Zealous|/ˈzel.əs/|adjective|Having great energy for a cause.|passionate,ardent|apathetic,indifferent|GRE
Zenith|/ˈzen.ɪθ/|noun|The time at which something is strongest.|peak,apex|nadir,bottom|GRE
`;

const lines = RAW.trim().split('\n').filter(Boolean);
const seen = new Set();
const words = [];

lines.forEach((line, i) => {
  const [word, phonetic, pos, def, syn, ant, tags] = line.split('|');
  if (!word || seen.has(word)) return;
  seen.add(word);
  const tagList = tags.split(',').map((t) => t.trim());
  const ex = `The context made the meaning of <em>${word.toLowerCase()}</em> clear to every student.`;
  words.push({
    word,
    phonetic,
    pos,
    def,
    example: ex,
    syn,
    ant,
    tags: tagList,
    premium: i >= 150,
  });
});

const out = path.join(__dirname, '..', 'data', 'words.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(words, null, 0));
console.log('Wrote', words.length, 'words to', out);
