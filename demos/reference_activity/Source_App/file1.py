ques = {
			'Q1':{
			'text':'You are lost in Sahara desert. What do you do?',
			'options':{
					'a': {
						'text': 'A. You will start moving in any direction randomly.',
						'response': 'Good, lets see your next move',
						'jump': 'Q3'
						},
					'b': {
						'text': 'B. You will look out for options available to survive.',
						'response': 'You open a backpack and a squirel passes from back your foot',
						'jump': 'Q2'
						},
					'c': {
						'text': 'C. You will give up and quit your life.',
						'response': 'Ohh poor, you are dead'	,
						'jump': '-1'
						}
					}
				},
			'Q2':{ 
			'text':'How will you survive',
			'options':{ 
						'a':{
						 'text': 'A. Will make some food and find shelter',
						 'response': 'in deserts the temperature falls quickly at night',
						 'jump': 'Q3',
							},
						'b':{
						 'text': 'B. Eat Animals',
						 'response': 'oh it caused food poisoning',
						 'jump': 'Q4',
							},
						'c':{
						 'text': 'C. Sleep 1 night without having food.',
						 'response': 'you starve due to dehydration and hunger'	,
						 'jump': '-1'
							}
						}
				 },
			'Q3':{ 
			'text':'What next',
			'options':{ 
						'a':{
						 'text': 'A. You will work to light up the fire',
						 'response': 'A sand dune approach and you die at night',
						 'jump': '-1',
							},
						'b':{
						 'text': 'B. You will search for plants',
						 'response': 'oh poor, its a desert and next palm is 50 kms away',
						 'jump': 'Q4',
							},
						'c':{
						 'text': 'C. You will find shelter',
						 'response': 'A sand dune approach adn you die at night'	,
						 'jump': '-1'
							}
						}
				 },				
			'Q4':{ 
			'text':'You are dehydrating fast and only have a cactus nearby. Oasis is still 45 kms away',
			'options':{ 
						'a':{
						 'text': 'A. You find a lamp and rub it hoping for a djinn to grant wishes',
						 'response': 'Aww poor this is not Disney, you die',
						 'jump': '-1',
							},
						'b':{
						 'text': 'B. You continue moving ahead',
						 'response': 'You die of starvation and desert burns',
						 'jump': '-1',
							},
						'c':{
						 'text': 'C. You Decide to start using cactus roots to collect as much water as possible',
						 'response': 'You manage to reach the oasis after 1 insufferable day. Congratz you survived'	,
						 'jump': '-1'
							}
						}
				 }	 
		}		 	 

# jump = 'Q1'
# jump = ques[jump]['options']['a']['jump']
# print(jump)
# print(ques[jump]['text'])

# for o in ques[jump]['options']:
# 	print(o)
# 	print(ques[jump]['options'][o]['text'])
# options =""ssss	