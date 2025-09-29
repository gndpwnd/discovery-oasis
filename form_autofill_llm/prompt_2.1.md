(venv) dev@DB-78GB094:~/discovery-oasis/form_autofill_llm$ tree -I "__pycache__"
.
├── application_questions.json
├── chrome_extension
│   ├── config.js
│   ├── content.js
│   ├── fieldDetector.js
│   ├── formFiller.js
│   ├── jsonUtils.js
│   ├── llmApi.js
│   ├── manifest.json
│   ├── popup.html
│   └── popup_controller.js
├── llm_app
│   ├── form_processor.py
│   ├── llm_service.py
│   ├── main.py
│   └── rag_manager.py
├── my_information.json
├── prompt.md
├── prompt_2.0.md
├── self_identify.json
├── voluntary_disclosure.json
└── work_experience.json

2 directories, 20 files
(venv) dev@DB-78GB094:~/discovery-oasis/form_autofill_llm$

I want to make a chrome extension that will use a local LLM to help me fill out forms, essentially, i want to have a python fast api app, then my chrome extension. My chrome extenstion will send all input boxes for all information and forms and everything to my fast api app in the form of a dictionary of terms where the keys are the html elements and the values are the element lables such as the questions that are asked before the input or the label of thte input like name or your skills, then my fast api app will send a chat message to a locally run llm that runs on ollama to determine what information, provided by the user, stored in a local JSON file, will go into the corresponding data entry field, the fast api app will then return a dictionary of keys that are the html elements and the values are the LLM's answers to what should go in those fields. this way my chrome extension will then be able to determine what type of input each input is and then be able to parse the dictionary keys and values to properly input each piece of information to the box. basically, i want to use the chrome extension by doing what i need to do on an html page, but when i need to have some help on entering some fields, then i will be able to press a button labled "send to LLM" and then those fields will be automatically populated or list items will be automatically selected based on hte responses from the LLM.

I have the following chrome extension that helps to automate filling out of forms, but it is constrained to one website, i want to help people automate their form filling.

The python application will have a md_docs/ direcotry where markdown files will be stored with documentation about the user, used for RAG, so the LLM will have context for filling out the answers. I want to be able to dynamically edit the markdown docs while the app is running, detect changes and update the context of the LLM when answering questions. what technologies should i use for this python app? i want to use fast api, fast mcp, ollama, and i need to devise a RAG solution.



the ability to fill out the form fields when given a response json, the response JSON would basiclally be in the same format. I don't want to change the chrome extension at all, but rather add a button that says "Send to LLM" that sends the JSON to an api url.

I also want to be able to edit the url of the api that the JSON gets sent to, but make the default api url http://localhost:8000/

then i want to have the ability to actually auto fill the fields of the form from the response JSON file, again don't get rid of the basic functionaliyt of downloading the form as a JSON as i will use this for debugging in the future.

I have also added sample JSON files that show where what information might, go, again don't use these HTML elemetn IDs specifically, but i want to let you know what can be expected


Please keep the extension development modular with samller files so it is easier to maintaint and work with. Please help me improve or fix my app.

my application is working near perfectly, I want to emphasize that while all fields of input are being detected, it should be recorded what is already in fields if they are already filled out, this way the information that might already be entered on the page will not be modifyed, this is simply an app to help in the process of filling out forms, not overwriting what user's already have, but right now i would say the App is 90 percent effective.

the onlyt changes i would make is for helping to answer questions like the following:

i want to be able to add to my documentation that is being used for the RAG that i would like to be contacted for more opportunities, so that if an element talks about something like it, then it will be selected Yes, chekced yes, or answered yes, do you know what i mean? effectively delegating the answering of questions to the LLM by leveraging my RAG documentation. i am adding a new file called, question_preferences.md where i will add things like

"If a job requires me to allow them to contact me regarding future job offers, i choose to be notified about those offers."

then i want to add documentation files to my md_docs/ directory like actual documentation for programming projects so that the LLM will know what kind of work i am familiar with to help answer questions and generate responses, i will also add to my question_preferences things like my skills:

dev@DB-78GB094:~/discovery-oasis/form_autofill_llm$ tree -I "__pycache__"

.

├── application_questions.json

├── chrome_extension

│   ├── autoFillOrchestrator.js

│   ├── config.js

│   ├── content.js

│   ├── fieldDetector.js

│   ├── formFiller.js

│   ├── jsonUtils.js

│   ├── llmApi.js

│   ├── manifest.json

│   ├── popup-controller.js

│   └── popup.html

├── llm_app

│   ├── form_processor.py

│   ├── llm_service.py

│   ├── main.py

│   ├── md_docs

│   │   └── user_profile.md

│   └── rag_manager.py

├── my_information.json

├── prompt.md

├── prompt_2.0.md

├── self_identify.json

├── voluntary_disclosure.json

└── work_experience.json

3 directories, 22 files

dev@DB-78GB094:~/discovery-oasis/form_autofill_llm$ 

so please help me fix the bugs in my extension code so i can start testing out my documentation for RAG method