from file1 import *

print("\n --------Let the Game Begin-------- \n")

jump = 'Q1'

while(jump!='-1'):

	print(ques[jump]['text'])

	options = "Enter option Number that you would choose. \n"
	
	for op in ques[jump]['options']:
		options = options + ques[jump]['options'][op]['text']+'\n'
	
	option = (input(options)).lower()
	
	if (option in ques[jump]['options']):
	
		print(ques[jump]['options'][option]['response'])
	
		jump = ques[jump]['options'][option]['jump']
	
	else:
	
		print("enter valid option")
	
		continue

print("\n --------GAME OVER--------")