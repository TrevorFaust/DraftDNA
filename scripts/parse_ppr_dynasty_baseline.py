#!/usr/bin/env python3
"""
Parse PPR/dynasty/non-superflex baseline rankings and output SQL for migration.
Format: RK, WSID, Player Name, POS, AGE, BEST, WORST, AVG - use column 8 (AVG).
FA players -> baseline_rookies for ppr/dynasty/non-superflex if not in players.
"""

import re
import sys

# Raw data: tab-separated. Cols: RK, WSID, Player Name, POS, AGE, BEST, WORST, AVG (index 7)
RAW = """1		Ja'Marr Chase (CIN)	WR1	25	1	2	1.1	0.2	-
2		Puka Nacua (LAR)	WR2	24	2	7	2.7	1.1	-
3		Jaxon Smith-Njigba (SEA)	WR3	24	2	6	3.3	1.3	-
4		Bijan Robinson (ATL)	RB1	24	2	5	4.7	0.8	-
5		Jahmyr Gibbs (DET)	RB2	23	4	7	5.8	0.6	-
6		CeeDee Lamb (DAL)	WR4	26	3	10	6.3	2.1	-
7		Justin Jefferson (MIN)	WR5	26	2	9	6.5	1.9	-
8		Amon-Ra St. Brown (DET)	WR6	26	4	13	8.1	2.7	-
9		Malik Nabers (NYG)	WR7	22	4	14	9.4	2.8	-
10		Ashton Jeanty (LV)	RB3	22	9	20	10.8	2.7	-
11		Drake London (ATL)	WR8	24	8	14	11.6	1.9	-
12		De'Von Achane (MIA)	RB4	24	9	16	12.1	2.1	-
13		James Cook III (BUF)	RB5	26	12	24	15.8	3.5	-
14		Jonathan Taylor (IND)	RB6	27	12	25	15.9	3.9	-
15		Nico Collins (HOU)	WR9	26	10	26	16.3	3.8	-
16		George Pickens (DAL)	WR10	24	12	26	18.1	3.5	-
17		Omarion Hampton (LAC)	RB7	22	12	34	18.4	4.9	-
18		Tetairoa McMillan (CAR)	WR11	22	14	33	20.2	5.4	-
19		Josh Allen (BUF)	QB1	29	19	33	22	4.4	-
20		Brock Bowers (LV)	TE1	23	10	31	22.4	5.6	-
21		Rashee Rice (KC)	WR12	25	16	37	22.6	5.6	-
22		Garrett Wilson (NYJ)	WR13	25	20	30	24.2	2.9	-
23		Trey McBride (ARI)	TE2	26	8	31	25.3	6.8	-
24		Chris Olave (NO)	WR14	25	18	43	25.5	6.8	-
25		Jeremiyah Love (FA)	RB8	20	9	64	27	22.9	-
26		Ladd McConkey (LAC)	WR15	24	18	38	29.1	4.7	-
27		Drake Maye (NE)	QB2	23	19	56	29.6	9.6	-
28		Emeka Egbuka (TB)	WR16	23	18	70	30.9	11.2	-
29		A.J. Brown (PHI)	WR17	28	18	57	34	9.3	-
30		Tee Higgins (CIN)	WR18	27	22	49	34.8	6.5	-
31		Breece Hall (NYJ)	RB9	24	16	64	35	13.7	-
32		Jordyn Tyson (FA)	WR19	21	33	40	35.8	2.7	-
33		Bucky Irving (TB)	RB10	23	21	52	36.1	11.2	-
34		Carnell Tate (FA)	WR20	21	27	71	38	16.7	-
35		Zay Flowers (BAL)	WR21	25	26	57	39.5	7.3	-
36		Brian Thomas Jr. (JAC)	WR22	23	25	75	40.5	13.1	-
37		Makai Lemon (FA)	WR23	21	33	59	40.6	9.5	-
38		TreVeyon Henderson (NE)	RB11	23	21	65	40.6	15.9	-
39		Rome Odunze (CHI)	WR24	23	31	67	40.8	9.2	-
40		Lamar Jackson (BAL)	QB3	29	25	88	41	15.8	-
41		DeVonta Smith (PHI)	WR25	27	32	59	41.5	8	-
42		Jayden Daniels (WAS)	QB4	25	27	84	41.6	14.3	-
43		Joe Burrow (CIN)	QB5	29	26	55	41.8	6.5	-
44		Jameson Williams (DET)	WR26	24	29	67	41.9	10	-
45		Colston Loveland (CHI)	TE3	21	19	53	42.7	6.7	-
46		Chase Brown (CIN)	RB12	25	24	64	43	9.6	-
47		Marvin Harrison Jr. (ARI)	WR27	23	27	79	44.9	14	-
48		Jaylen Waddle (MIA)	WR28	27	32	67	45.4	8.7	-
49		Luther Burden III (CHI)	WR29	22	21	83	46.4	16.9	-
50		Christian McCaffrey (SF)	RB13	29	23	68	47.5	13.3	-
51		Saquon Barkley (PHI)	RB14	29	14	68	48	15	-
52		Tyler Warren (IND)	TE4	23	40	60	48.3	4.8	-
53		Jalen Hurts (PHI)	QB6	27	28	82	51.1	10.4	-
54		Patrick Mahomes II (KC)	QB7	30	36	89	52	15	-
55		Tucker Kraft (GB)	TE5	25	47	74	53.3	7.9	-
56		Harold Fannin Jr. (CLE)	TE6	21	36	73	55.2	8.7	-
57		Quinshon Judkins (CLE)	RB15	22	39	77	55.5	10.2	-
58		Kenneth Walker III (SEA)	RB16	25	35	77	55.9	12.3	-
59		Kyren Williams (LAR)	RB17	25	29	80	56.8	12.9	-
60		Sam LaPorta (DET)	TE7	25	44	93	58	10.8	-
61		Justin Herbert (LAC)	QB8	27	45	100	58.3	14.6	-
62		Josh Jacobs (GB)	RB18	28	29	77	58.9	10.9	-
63		Caleb Williams (CHI)	QB9	24	36	113	60	23.6	-
64		RJ Harvey (DEN)	RB19	25	34	87	60	12.3	-
65		Kyle Pitts Sr. (ATL)	TE8	25	53	81	64.4	7.9	-
66		Jordan Addison (MIN)	WR30	24	40	87	64.8	13	-
67		Jaxson Dart (NYG)	QB10	22	51	109	65.2	15.3	-
68		DK Metcalf (PIT)	WR31	28	47	93	66.9	11.2	-
69		Cam Skattebo (NYG)	RB20	24	51	80	67.6	8.3	-
70		Bo Nix (DEN)	QB11	26	56	99	71.8	14.1	-
71		Travis Etienne Jr. (JAC)	RB21	27	57	89	72	9.3	-
72		Christian Watson (GB)	WR32	26	38	95	72.3	16.5	-
73		Ricky Pearsall (SF)	WR33	25	60	92	72.7	6.8	-
74		Brock Purdy (SF)	QB12	26	56	100	72.8	13.7	-
75		Travis Hunter (JAC)	WR34	22	42	125	76.5	24.9	-
76		Trevor Lawrence (JAC)	QB13	26	56	113	76.6	17.9	-
77		Javonte Williams (DAL)	RB22	25	58	88	77.6	11.1	-
78		Denzel Boston (FA)	WR35	22	59	115	78	19.3	-
79		Dalton Kincaid (BUF)	TE9	26	69	108	79.8	10.6	-
80		Terry McLaurin (WAS)	WR36	30	48	103	80.8	12.6	-
81		Courtland Sutton (DEN)	WR37	30	52	114	82.1	17.6	-
82		Derrick Henry (BAL)	RB23	32	63	120	82.5	13.7	-
83		Michael Pittman Jr. (IND)	WR38	28	65	100	83.3	11.1	-
84		Xavier Worthy (KC)	WR39	22	59	134	83.9	20.3	-
85		Oronde Gadsden II (LAC)	TE10	22	58	137	84.8	23	-
86		Davante Adams (LAR)	WR40	33	57	121	86.6	14.5	-
87		Michael Wilson (ARI)	WR41	26	38	118	88	17.5	-
88		Jordan Love (GB)	QB14	27	61	115	88	16.1	-
89		Jakobi Meyers (JAC)	WR42	29	67	109	88.5	13.8	-
90		D'Andre Swift (CHI)	RB24	27	71	120	90.3	11.1	-
91		DJ Moore (CHI)	WR43	28	53	126	90.6	18.3	-
92		Wan'Dale Robinson (NYG)	WR44	25	60	118	90.9	14.7	-
93		Jayden Higgins (HOU)	WR45	23	67	120	92.3	14.6	-
94		Jake Ferguson (DAL)	TE11	27	69	121	92.7	17.2	-
95		Dak Prescott (DAL)	QB15	32	61	147	96.3	18.6	-
96		K.C. Concepcion (FA)	WR46	21	56	122	97.2	25.4	-
97		Jonah Coleman (FA)	RB25	22	57	130	98.3	26.5	-
98		Alec Pierce (IND)	WR47	25	68	192	99.2	27.6	-
99		Quentin Johnston (LAC)	WR48	24	74	151	99.3	17.5	-
100		Kenyon Sadiq (FA)	TE12	20	70	144	100.3	28.9	-
101		George Kittle (SF)	TE13	32	53	155	100.4	31.4	-
102		Khalil Shakir (BUF)	WR49	26	72	126	100.6	13.7	-
103		Jaylen Warren (PIT)	RB26	27	80	133	101	17.2	-
104		Brenton Strange (JAC)	TE14	25	68	177	101.2	24.6	-
105		Brandon Aiyuk (SF)	WR50	27	73	175	104.3	19.8	-
106		Kyle Monangai (CHI)	RB27	23	84	149	104.9	16.5	-
107		Baker Mayfield (TB)	QB16	30	84	146	105.6	15.9	-
108		Zach Charbonnet (SEA)	RB28	25	88	141	105.7	16.6	-
109		Jayden Reed (GB)	WR51	25	70	138	106	15.6	-
110		Eli Stowers (FA)	TE15	22	78	163	106.5	29.1	-
111		Matthew Golden (GB)	WR52	22	85	132	108.3	11.6	-
112		Mike Evans (TB)	WR53	32	79	163	108.4	16.3	-
113		Jauan Jennings (SF)	WR54	28	77	145	109	16.6	-
114		C.J. Stroud (HOU)	QB17	24	84	141	109.5	15.3	-
115		Fernando Mendoza (FA)	QB18	22	91	127	112.8	13.2	-
116		Jared Goff (DET)	QB19	31	72	148	113.5	16	-
117		Chris Godwin Jr. (TB)	WR55	30	88	179	113.8	20.7	-
118		Josh Downs (IND)	WR56	24	90	146	114	16.9	-
119		Blake Corum (LAR)	RB29	25	77	149	115.1	20.4	-
120		Woody Marks (HOU)	RB30	25	83	160	115.5	26.4	-
121		Trey Benson (ARI)	RB31	23	76	162	116.7	24.2	-
122		Stefon Diggs (NE)	WR57	32	95	151	118	16.9	-
123		Bhayshul Tuten (JAC)	RB32	24	81	158	120.2	22	-
124		Sam Darnold (SEA)	QB20	28	110	147	120.3	9.5	-
125		Rhamondre Stevenson (NE)	RB33	28	78	158	122.5	22.7	-
126		Mason Taylor (NYJ)	TE16	21	89	176	124.2	21.7	-
127		Parker Washington (JAC)	WR58	23	79	212	124.7	28.7	-
128		Rico Dowdle (CAR)	RB34	27	92	165	125.1	21.7	-
129		Dallas Goedert (PHI)	TE17	31	89	183	128.8	23.3	-
130		Jalen Coker (CAR)	WR59	24	83	171	130.2	22.9	-
131		Troy Franklin (DEN)	WR60	23	95	199	131.1	28.5	-
132		Chuba Hubbard (CAR)	RB35	26	86	178	132.4	22.9	-
133		David Montgomery (DET)	RB36	28	86	193	134.9	26.2	-
134		Theo Johnson (NYG)	TE18	24	114	186	135.1	19	-
135		Terrance Ferguson (LAR)	TE19	22	78	207	135.6	33.5	-
136		Deebo Samuel Sr. (WAS)	WR61	30	106	240	136.6	31.4	-
137		Romeo Doubs (GB)	WR62	25	114	171	136.9	14.1	-
138		Tyreek Hill (FA)	WR63	31	73	194	137.7	31.2	-
139		Tyrone Tracy Jr. (NYG)	RB37	26	94	185	138.6	22	-
140		Kyler Murray (ARI)	QB21	28	109	167	138.8	11.4	-
141		Tre Harris (LAC)	WR64	23	100	212	138.9	28.3	-
142		Cam Ward (TEN)	QB22	23	96	163	127.2	14.9	-
143		Rashid Shaheed (SEA)	WR65	27	107	192	141.2	21.6	-
144		Tyler Allgeier (ATL)	RB38	25	100	197	142	26.2	-
145		Jalen McMillan (TB)	WR66	24	100	180	142.7	22.2	-
146		Jerry Jeudy (CLE)	WR67	26	105	274	145.4	36.2	-
147		Mark Andrews (BAL)	TE20	30	74	221	145.7	31.1	-
148		Bryce Young (CAR)	QB23	24	127	208	145.8	16.9	-
149		Juwan Johnson (NO)	TE21	29	114	189	146.3	24.3	-
150		Isaiah Likely (BAL)	TE22	25	116	197	146.8	24.8	-
151		Matthew Stafford (LAR)	QB24	38	126	208	147.8	16.1	-
152		Tony Pollard (TEN)	RB39	28	107	197	150.3	22.5	-
153		Jacory Croskey-Merritt (WAS)	RB40	24	111	185	150.7	17.8	-
154		J.J. McCarthy (MIN)	QB25	23	111	242	150.8	29.2	-
155		Michael Trigg (FA)	TE23	-	124	187	151.6	22.7	-
156		Elic Ayomanor (TEN)	WR68	22	129	179	151.8	14.5	-
157		T.J. Hockenson (MIN)	TE24	28	99	211	152.6	28.9	-
158		Jaylin Noel (HOU)	WR69	23	94	242	152.8	30.6	-
159		Kayshon Boutte (NE)	WR70	23	102	214	153.9	24.3	-
160		Michael Penix Jr. (ATL)	QB26	25	127	207	153.9	18.7	-
161		Malachi Fields (FA)	WR71	-	115	194	154	26.9	-
162		Daniel Jones (IND)	QB27	28	135	204	155.9	16.3	-
163		Pat Bryant (DEN)	WR72	23	94	234	157.1	30.9	-
164		Adonai Mitchell (NYJ)	WR73	23	118	256	157.3	32.2	-
165		Tyler Shough (NO)	QB28	26	111	238	144.6	25	-
166		Kenneth Gainwell (PIT)	RB41	26	106	294	158.8	38.5	-
167		Omar Cooper Jr. (FA)	WR74	22	101	302	159.2	70.3	-
168		Chris Brazzell II (FA)	WR75	-	138	192	159.5	18.5	-
169		Mike Washington Jr. (FA)	RB42	-	104	187	160.4	29.5	-
170		Hunter Henry (NE)	TE25	31	110	189	161.8	21.3	-
171		Jadarian Price (FA)	RB43	22	88	303	163.1	68	-
172		Tyjae Spears (TEN)	RB44	24	132	226	166.3	20.6	-
173		J.K. Dobbins (DEN)	RB45	27	105	220	166.5	27.6	-
174		Dalton Schultz (HOU)	TE26	29	123	195	169.8	23.5	-
175		Kyle Williams (NE)	WR76	23	134	258	172.6	28.1	-
176		Alvin Kamara (NO)	RB46	30	120	306	172.6	37.6	-
177		AJ Barner (SEA)	TE27	23	106	212	160.8	35.4	-
178		Chimere Dike (TEN)	WR77	24	125	295	172.9	40.9	-
179		David Njoku (CLE)	TE28	29	141	213	173.7	19	-
180		Keon Coleman (BUF)	WR78	22	122	254	174.9	34.8	-
181		Kaleb Johnson (PIT)	RB47	22	102	278	175.9	32.7	-
182		Tory Horton (SEA)	WR79	23	139	232	176.6	19.5	-
183		Elijah Arroyo (SEA)	TE29	22	153	208	179.8	17.9	-
184		Darnell Mooney (ATL)	WR80	28	125	299	180.4	37.1	-
185		Jordan Mason (MIN)	RB48	26	152	271	180.7	26.6	-
186		Tua Tagovailoa (MIA)	QB29	27	147	257	180.9	29.7	-
187		Dylan Sampson (CLE)	RB49	21	158	219	181.9	17.5	-
188		Isaac TeSlaa (DET)	WR81	24	142	247	182.6	24.9	-
189		Germie Bernard (FA)	WR82	22	148	256	182.8	43.5	-
190		Elijah Sarratt (FA)	WR83	22	107	313	184.3	64.3	-
191		Aaron Jones Sr. (MIN)	RB50	31	132	226	184.8	23.8	-
192		Rachaad White (TB)	RB51	27	158	225	186.3	17.8	-
193		Zachariah Branch (FA)	WR84	21	152	244	186.8	36.1	-
194		James Conner (ARI)	RB52	30	121	225	186.9	25.5	-
195		Emmett Johnson (FA)	RB53	22	101	308	187.6	63.7	-
196		Calvin Ridley (TEN)	WR85	31	113	293	187.8	41.3	-
197		Antonio Williams (FA)	WR86	21	173	214	188	14.9	-
198		Chris Bell (FA)	WR87	-	124	315	188.5	61.6	-
199		Tank Dell (HOU)	WR88	26	148	294	189.8	31.6	-
200		Ja'Kobi Lane (FA)	WR89	21	151	228	189.8	27.1	-
201		Marvin Mims Jr. (DEN)	WR90	23	143	238	190.3	26.9	-
202		Brian Robinson Jr. (SF)	RB54	26	135	245	190.4	31.3	-
203		Travis Kelce (KC)	TE30	36	121	307	190.7	37.6	-
204		Isiah Pacheco (KC)	RB55	26	136	310	191.2	35.6	-
205		Braelon Allen (NYJ)	RB56	22	139	309	192.4	32.7	-
206		Tank Bigsby (PHI)	RB57	23	164	221	192.8	17.4	-
207		Pat Freiermuth (PIT)	TE31	27	144	263	197.8	31.1	-
208		Jonathon Brooks (CAR)	RB58	22	129	270	197.8	36.8	-
209		Chig Okonkwo (TEN)	TE32	26	123	270	198.1	29.7	-
210		Kimani Vidal (LAC)	RB59	24	143	273	198.7	29.1	-
211		Cade Otton (TB)	TE33	26	161	271	199.1	26.1	-
212		Dontayvion Wicks (GB)	WR91	24	173	243	202.3	23.3	-
213		Devin Neal (NO)	RB60	22	145	310	205	41.3	-
214		Rashod Bateman (BAL)	WR92	26	151	265	195.2	29.8	-
215		Anthony Richardson Sr. (IND)	QB30	23	150	257	205.8	32.5	-
216		Shedeur Sanders (CLE)	QB31	24	154	254	195.9	29.7	-
217		Christian Kirk (HOU)	WR93	29	138	271	206.8	34.7	-
218		Evan Engram (DEN)	TE34	31	116	292	207.1	36.1	-
219		Malik Willis (GB)	QB32	26	111	240	175.9	37.8	-
220		Kaytron Allen (FA)	RB61	23	136	307	211.4	45.5	-
221		Cedric Tillman (CLE)	WR94	25	145	285	201.5	34.3	-
222		Nicholas Singleton (FA)	RB62	22	168	241	211.7	25	-
223		Jack Bech (LV)	WR95	23	131	267	202.2	34.9	-
224		Cooper Kupp (SEA)	WR96	32	135	378	214.6	48.9	-
225		Ty Simpson (FA)	QB33	23	204	241	216	15.1	-
226		Tez Johnson (TB)	WR97	23	174	273	219.8	26.6	-
227		Xavier Legette (CAR)	WR98	25	148	350	210.8	46.9	-
228		Ollie Gordon II (MIA)	RB63	22	154	295	220.4	33.5	-
229		Ray Davis (BUF)	RB64	26	158	297	221.1	35.6	-
230		Tre Tucker (LV)	WR99	24	170	256	212.7	23.5	-
231		Michael Mayer (LV)	TE35	24	163	301	214.5	33.1	-
232		Keenan Allen (LAC)	WR100	33	174	379	214.7	46.8	-
233		Jaylen Wright (MIA)	RB65	22	185	288	225.4	28.1	-
234		Sean Tucker (TB)	RB66	24	156	295	226.8	33.4	-
235		Malik Washington (MIA)	WR101	25	183	304	220.6	26.7	-
236		Ben Sinnott (WAS)	TE36	23	148	319	211.2	40.1	-
237		Marquise Brown (KC)	WR102	28	170	370	222.6	50.8	-
238		Justin Fields (NYJ)	QB34	26	166	258	214.1	31	-
239		DeMario Douglas (NE)	WR103	25	175	359	226.8	51.6	-
240		Darius Slayton (NYG)	WR104	29	191	349	229.2	33.1	-
241		Geno Smith (LV)	QB35	35	167	273	232.3	22.5	-
242		Devaughn Vele (NO)	WR105	28	198	377	232.8	37.4	-
243		Kendre Miller (NO)	RB67	23	158	295	239.7	35.8	-
244		Keaton Mitchell (BAL)	RB68	24	188	320	240.1	35.2	-
245		Mac Jones (SF)	QB36	27	167	245	213.7	22.7	-
246		Demond Claiborne (FA)	RB69	22	203	278	252.2	29.7	-
247		Najee Harris (LAC)	RB70	27	166	392	245.1	48.8	-
248		Jalen Royals (KC)	WR106	23	179	330	246.6	38.4	-
249		Joe Mixon (HOU)	RB71	29	138	318	238.4	41.6	-
250		Isaiah Bond (CLE)	WR107	21	190	359	247	45.5	-
251		Skyler Bell (FA)	WR108	23	225	317	254.8	33.4	-
252		Gunnar Helm (TEN)	TE37	23	133	231	194	27	-
253		Jaydon Blue (DAL)	RB72	22	192	333	251.7	41	-
254		Brashard Smith (KC)	RB73	22	189	368	254.3	41.8	-
255		Joshua Palmer (BUF)	WR109	26	174	390	241.5	46.6	-
256		Chris Rodriguez Jr. (WAS)	RB74	26	166	328	253.3	47.5	-
257		Isaiah Davis (NYJ)	RB75	24	196	321	261.4	37	-
258		Andrei Iosivas (CIN)	WR110	26	209	360	247.1	35.8	-
259		Roman Wilson (PIT)	WR111	24	209	377	255.7	46.1	-
260		Cole Kmet (CHI)	TE38	26	184	322	241.1	40.1	-
261		Adam Randall (FA)	RB76	-	200	358	275.4	67.7	-
262		Roman Hemby (FA)	RB77	23	220	361	276.5	56.9	-
263		Ryan Flournoy (DAL)	WR112	26	171	273	235.1	25.2	-
264		Emanuel Wilson (GB)	RB78	26	142	327	254.8	49.8	-
265		DJ Giddens (IND)	RB79	22	201	370	271.1	43.7	-
266		Aaron Rodgers (PIT)	QB37	42	207	312	237	24.4	-
267		Ja'Tavion Sanders (CAR)	TE39	22	204	375	248.9	42.8	-
268		Jarquez Hunter (LAR)	RB80	23	226	391	283.6	45.1	-
269		Jonnu Smith (PIT)	TE40	30	206	356	261.7	47.3	-
270		Colby Parkinson (LAR)	TE41	27	153	272	230	36.6	-
271		Dont'e Thornton Jr. (LV)	WR113	23	212	329	252.9	32.2	-
272		Calvin Austin III (PIT)	WR114	26	218	382	263.1	46.8	-
273		Isaac Guerendo (SF)	RB81	25	190	398	285.3	54.4	-
274		Jordan Whittington (LAR)	WR115	25	233	373	276.1	45	-
275		Jacoby Brissett (ARI)	QB38	33	167	348	227.8	47.7	-
276		Jaylin Lane (WAS)	WR116	23	237	378	273.5	45	-
277		Luke McCaffrey (WAS)	WR117	24	226	375	265.3	44.5	-
278		Will Shipley (PHI)	RB82	23	260	362	289.3	24.5	-
279		Jalen Milroe (SEA)	QB39	23	205	324	248.5	29.6	-
280		Kareem Hunt (KC)	RB83	30	214	381	277.3	36.7	-
281		Jake Tonges (SF)	TE42	26	163	334	236.3	44	-
282		Nick Chubb (HOU)	RB84	30	223	344	279	32.6	-
283		Audric Estime (NO)	RB85	22	199	310	273.8	32.9	-
284		Mike Gesicki (CIN)	TE43	30	207	341	254.8	36.4	-
285		Kirk Cousins (ATL)	QB40	37	224	289	246.9	15.8	-
286		John Metchie III (NYJ)	WR118	25	210	374	260	42.5	-
287		Devin Singletary (NYG)	RB86	28	222	322	279.1	28.2	-
288		Jerome Ford (CLE)	RB87	26	200	377	287.1	40.7	-
289		Trevor Etienne (CAR)	RB88	21	227	363	294.3	31	-
290		Tahj Brooks (CIN)	RB89	23	243	382	300.4	37.3	-
291		Darnell Washington (PIT)	TE44	24	207	317	253.9	33.1	-
292		Denver Broncos (DEN)	DST1	-	228	242	231.1	4.8	-
293		Jameis Winston (NYG)	QB41	32	205	354	261	35.9	-
294		Marcus Mariota (WAS)	QB42	32	239	356	263.3	29.7	-
295		Philadelphia Eagles (PHI)	DST2	-	231	278	239.6	14.2	-
296		Jalen Nailor (MIN)	WR119	26	228	372	277.1	42.2	-
297		Jordan James (SF)	RB90	21	241	393	300.6	31.4	-
298		Savion Williams (GB)	WR120	24	240	368	281.5	42.6	-
299		MarShawn Lloyd (GB)	RB91	25	238	379	297.9	35.1	-
300		Noah Gray (KC)	TE45	26	217	346	276.9	39.8	-
301		Jaleel McLaughlin (DEN)	RB92	25	224	364	302.1	34.5	-
302		Quinn Ewers (MIA)	QB43	22	205	357	270.4	42.9	-
303		Jalen Tolbert (DAL)	WR121	26	237	355	272.2	40.6	-
304		Brandon Aubrey (DAL)	K1	30	243	249	245.3	2.7	-
305		Houston Texans (HOU)	DST3	-	236	266	247.6	11	-
306		Pittsburgh Steelers (PIT)	DST4	-	236	323	263.3	27.9	-
307		Justice Hill (BAL)	RB93	28	225	367	303.6	33	-
308		Michael Carter (ARI)	RB94	26	179	347	297	40.5	-
309		DeAndre Hopkins (BAL)	WR122	33	196	360	266.6	48.7	-
310		Cam Little (JAC)	K2	22	246	308	256.2	18.9	-
311		KeAndre Lambert-Smith (LAC)	WR123	24	241	383	283.4	40.8	-
312		Minnesota Vikings (MIN)	DST5	-	253	297	272.7	15.2	-
313		Harrison Butker (KC)	K3	30	246	339	261.2	28.8	-
314		Spencer Rattler (NO)	QB44	25	228	352	275.2	38.9	-
315		Kansas City Chiefs (KC)	DST6	-	242	330	276.3	28.2	-
316		Los Angeles Rams (LAR)	DST7	-	248	303	264	19.6	-
317		Will Reichard (MIN)	K4	25	245	253	247.5	3	-
318		Bam Knight (ARI)	RB95	24	178	385	290.9	59.2	-
319		Roschon Johnson (CHI)	RB96	25	239	328	291.6	28.2	-
320		Elijah Moore (FA)	WR124	25	233	365	268.4	37.2	-
321		Detroit Lions (DET)	DST8	-	242	347	268.9	35.3	-
322		Buffalo Bills (BUF)	DST9	-	248	297	269.6	15.9	-
323		LeQuint Allen Jr. (JAC)	RB97	21	268	357	304.3	26.4	-
324		Cameron Dicker (LAC)	K5	25	259	324	274	19.5	-
325		Wil Lutz (DEN)	K6	31	259	326	275.7	20.2	-
326		Darren Waller (MIA)	TE46	33	216	348	276.1	38.4	-
327		Baltimore Ravens (BAL)	DST10	-	272	345	290.7	28.1	-
328		Chris Boswell (PIT)	K7	34	263	292	279.3	11.9	-
329		Jake Moody (WAS)	K8	26	260	281	265.5	7.9	-
330		Xavier Restrepo (TEN)	WR125	23	248	337	281.4	32.9	-
331		Luke Musgrave (GB)	TE47	25	248	341	294.6	33.2	-
332		Ty Johnson (BUF)	RB98	28	281	371	312.4	25	-
333		Russell Wilson (NYG)	QB45	37	238	358	268.8	36.4	-
334		New England Patriots (NE)	DST11	-	270	308	284.7	13.1	-
335		Tyler Lockett (LV)	WR126	33	233	344	270.4	36.1	-
336		Max Klare (FA)	TE48	-	124	166	141	16.2	-
337		Will Levis (TEN)	QB46	26	254	353	286.8	31.1	-
338		Joshua Karty (ARI)	K9	23	259	291	273.1	10.2	-
339		Noah Fant (CIN)	TE49	28	253	381	299.6	42.2	-
340		Seattle Seahawks (SEA)	DST12	-	239	314	278.4	23.8	-
341		Los Angeles Chargers (LAC)	DST13	-	255	333	292.4	21.9	-
342		Brandon McManus (GB)	K10	34	269	302	279	13.2	-
343		Konata Mumpfield (LAR)	WR127	23	236	294	261.7	18.8	-
344		Ka'imi Fairbairn (HOU)	K11	32	273	300	279.1	8.8	-
345		Trey Lance (LAC)	QB47	25	256	367	304.5	41	-
346		Will Howard (PIT)	QB48	24	244	362	281	39.1	-
347		Dawson Knox (BUF)	TE50	29	246	344	294.7	31.9	-
348		Evan McPherson (CIN)	K12	26	282	339	295.9	18.6	-
349		Blake Grupe (IND)	K13	27	273	308	282.9	12.6	-
350		Washington Commanders (WAS)	DST14	-	276	316	296.8	11	-
351		Joe Flacco (CIN)	QB49	41	239	384	285.9	42.1	-
352		Jack Endries (FA)	TE51	-	157	301	217.6	48.7	-
353		Green Bay Packers (GB)	DST15	-	280	337	299.1	22.1	-
354		Greg Dulcich (MIA)	TE52	25	219	371	287.6	47.7	-
355		Joe Milton III (DAL)	QB50	25	242	361	288.6	37.2	-
356		Zach Ertz (WAS)	TE53	35	199	319	273	37.9	-
357		Dillon Gabriel (CLE)	QB51	25	249	351	290.6	32	-
358		Ted Hurst (FA)	WR128	-	148	213	181.5	30.6	-
359		Mack Hollins (NE)	WR129	32	235	396	292.6	51.7	-
360		Tyquan Thornton (KC)	WR130	25	213	325	280.7	34.1	-
361		Chase McLaughlin (TB)	K14	29	281	326	295.8	15.8	-
362		Tyler Higbee (LAR)	TE54	33	276	388	307.7	36.2	-
363		Tyler Bass (BUF)	K15	29	268	342	298.8	22.6	-
364		Austin Ekeler (WAS)	RB99	30	285	342	310.4	19.3	-
365		Samaje Perine (CIN)	RB100	30	235	397	301.8	49	-
366		Davis Mills (HOU)	QB52	27	243	363	288.1	41.9	-
367		Deshaun Watson (CLE)	QB53	30	244	353	302.3	38.2	-
368		Ja'Lynn Polk (NO)	WR131	23	211	293	250.4	27.4	-
369		Miles Sanders (DAL)	RB101	28	263	363	308.8	25.7	-
370		Demarcus Robinson (SF)	WR132	31	251	395	295.9	47.4	-
371		Cleveland Browns (CLE)	DST16	-	294	341	309	17.5	-
372		Jacksonville Jaguars (JAC)	DST17	-	236	303	284.2	22	-
373		Jake Bates (DET)	K16	26	289	332	301.3	15.8	-
374		Antonio Gibson (NE)	RB102	27	262	366	315	30.3	-
375		Cade Stover (HOU)	TE55	25	260	393	333.3	46.1	-
376		Phil Mafah (DAL)	RB103	23	194	314	266.4	46.5	-
377		Brandin Cooks (BUF)	WR133	32	235	371	306.6	53	-
378		Riley Leonard (IND)	QB54	23	267	350	307	25.4	-
379		Jake Elliott (PHI)	K17	31	289	342	308.4	19.6	-
380		Kenny Pickett (LV)	QB55	27	269	374	310.1	35	-
381		Raheim Sanders (CLE)	RB104	23	267	386	322.1	45.8	-
382		Taysom Hill (NO)	TE56	35	227	335	277.4	36.5	-
383		Kevin Coleman Jr. (FA)	WR134	-	160	259	206.7	40.6	-
384		Gabe Davis (BUF)	WR135	26	228	368	304.5	55.7	-
385		Jawhar Jordan (HOU)	RB105	26	226	311	256.8	34.2	-
386		Tai Felton (MIN)	WR136	22	253	384	319	52.5	-
387		Eric McAlister (FA)	WR137	-	193	232	211.3	16	-
388		Gardner Minshew II (KC)	QB56	29	266	324	288	20.9	-
389		Chris Brooks (GB)	RB106	26	284	350	307.3	20.5	-
390		Emari Demercado (ARI)	RB107	27	220	288	261	25.4	-
391		Jermaine Burton (FA)	WR138	24	231	375	289.2	50.1	-
392		Mason Rudolph (PIT)	QB57	30	259	364	308	41.8	-
393		Garrett Nussmeier (FA)	QB58	24	215	316	262	36.4	-
394		Diontae Johnson (FA)	WR139	29	180	261	217.7	33.3	-
395		Jason Myers (SEA)	K18	34	293	353	310.7	25.3	-
396		Tyren Montgomery (FA)	WR140	-	208	240	220.7	13.9	-
397		Deion Burks (FA)	WR141	-	209	229	222	9.2	-
398		Rasheen Ali (BAL)	RB108	25	236	341	294.8	36.8	-
399		Tutu Atwell (LAR)	WR142	26	285	376	312.5	32.1	-
400		Aidan O'Connell (LV)	QB59	27	259	349	298.8	35.7	-
401		Tanner McKee (PHI)	QB60	25	244	386	317	50.1	-
402		Malik Davis (DAL)	RB109	27	176	289	233.7	46.2	-
403		Tanner Koziol (FA)	TE57	-	133	305	234	73.3	-
404		Justin Joly (FA)	TE58	-	181	294	235.3	46.2	-
405		Kendrick Bourne (SF)	WR143	30	265	369	302.2	42.8	-
406		Tyrod Taylor (NYJ)	QB61	36	260	387	318.7	46.4	-
407		Arizona Cardinals (ARI)	DST18	-	248	320	280.3	26.4	-
408		Nick Westbrook-Ikhine (FA)	WR144	28	249	394	307.6	53.8	-
409		Erick All Jr. (CIN)	TE59	25	268	372	323.2	36.8	-
410		Le'Veon Moss (FA)	RB110	-	216	344	284.5	55.1	-
411		Treylon Burks (WAS)	WR145	25	280	364	309.2	29.1	-
412		Malachi Corley (CLE)	WR146	23	241	374	310.6	50.5	-
413		Efton Chism III (NE)	WR147	24	257	358	311.4	35.9	-
414		Jake Browning (CIN)	QB62	29	257	362	315.6	37.4	-
415		Jahan Dotson (PHI)	WR148	25	276	377	331.5	37.7	-
416		Jared Wiley (KC)	TE60	25	221	363	299	51.4	-
417		Carson Wentz (MIN)	QB63	33	269	400	319.4	54.2	-
418		Dameon Pierce (KC)	RB111	26	296	308	299.8	4.8	-
419		Jimmy Horn Jr. (CAR)	WR149	23	264	398	335.8	49.1	-
420		Jeremy McNichols (WAS)	RB112	30	222	303	271.3	35.4	-
421		Dyami Brown (JAC)	WR150	26	293	352	325.2	20.1	-
422		Greg Dortch (ARI)	WR151	27	281	338	307.3	20.3	-
423		Xavier Hutchinson (HOU)	WR152	25	288	364	327.4	25.1	-
424		Thomas Fidone II (NYG)	TE61	23	270	366	328.4	35	-
425		Bryce Lance (FA)	WR153	-	155	285	220	65	-
426		KaVontae Turpin (DAL)	WR154	29	289	369	328.6	32.2	-
427		Brenen Thompson (FA)	WR155	-	235	361	282	56.2	-
428		Tyler Loop (BAL)	K19	24	253	303	282	21.2	-
429		Tyrell Shavers (BUF)	WR156	26	238	323	287.7	36.1	-
430		Tommy Tremble (CAR)	TE62	25	293	339	317.3	17.6	-
431		Jalin Hyatt (NYG)	WR157	24	260	384	334	49.4	-
432		Zach Wilson (MIA)	QB64	26	283	399	334.2	44.2	-
433		JuJu Smith-Schuster (KC)	WR158	29	251	347	290.3	41.1	-
434		Jarrett Stidham (DEN)	QB65	29	259	366	334.8	39.1	-
435		Mitchell Evans (CAR)	TE63	22	306	386	346.7	30.6	-
436		Austin Hooper (NE)	TE64	31	292	373	337	27.8	-
437		Damien Martinez (GB)	RB113	22	293	298	296	2.2	-
438		Khalil Herbert (NYJ)	RB114	27	282	304	296.7	10.4	-
439		Cole Payton (FA)	QB66	-	224	358	298	55.6	-
440		Tyler Huntley (BAL)	QB67	28	274	340	301.7	28	-
441		Devontez Walker (BAL)	WR159	24	299	379	341.6	25.7	-
442		Mitchell Trubisky (BUF)	QB68	31	258	358	303.3	41.4	-
443		Jimmy Garoppolo (LAR)	QB69	34	268	397	342.4	44.1	-
444		Curtis Samuel (BUF)	WR160	29	259	364	328	42.3	-
445		Robert Henry Jr. (FA)	RB115	-	156	356	256	100	-
446		Noah Brown (WAS)	WR161	30	269	378	329	47.5	-
447		Will Dissly (LAC)	TE65	29	274	390	329.5	45.9	-
448		Javon Baker (FA)	WR162	24	245	273	259	14	-
449		Drew Allar (FA)	QB70	21	254	265	259.5	5.5	-
450		Josh Oliver (MIN)	TE66	28	295	377	344.6	27.4	-
451		Theo Wease Jr. (MIA)	WR163	24	200	331	265.5	65.5	-
452		Olamide Zaccheaus (CHI)	WR164	28	287	395	347.2	36	-
453		Carson Beck (FA)	QB71	-	264	340	311.7	33.9	-
454		Seth McGowan (FA)	RB116	-	210	364	312.7	72.6	-
455		Zamir White (LV)	RB117	26	278	357	313.3	32.8	-
456		Matt Gay (FA)	K20	31	259	281	270	11	-
457		Philip Rivers (IND)	QB72	44	266	274	270	4	-
458		Elijah Higgins (ARI)	TE67	25	311	390	348.8	31.2	-
459		Joe Royer (FA)	TE68	-	188	355	271.5	83.5	-
460		Kevin Austin Jr. (NO)	WR165	25	226	321	273.5	47.5	-
461		Brady Cook (NYJ)	QB73	24	269	278	273.5	4.5	-
462		Raheem Mostert (LV)	RB118	33	252	296	274	22	-
463		Darius Cooper (PHI)	WR166	24	266	354	318.7	38	-
464		Tyler Conklin (LAC)	TE69	30	282	395	341.3	43.8	-
465		Younghoe Koo (FA)	K21	31	271	293	282	11	-
466		Joshua Dobbs (NE)	QB74	31	292	386	341.8	34.9	-
467		J'Mari Taylor (FA)	RB119	-	313	336	325.3	9.5	-
468		Jahdae Walker (CHI)	WR167	23	254	322	288	34	-
469		Tyson Bagent (CHI)	QB75	25	266	380	344.5	45.7	-
470		Elijah Mitchell (NE)	RB120	27	269	308	288.5	19.5	-
471		New York Jets (NYJ)	DST19	-	289	293	291	2	-
472		Jam Miller (FA)	RB121	-	275	363	327.7	38	-
473		Davis Allen (LAR)	TE70	25	250	394	358	54.7	-
474		Zack Moss (FA)	RB122	28	277	311	294	17	-
475		Aaron Anderson (FA)	WR168	-	222	369	295.5	73.5	-
476		Jordan Watkins (SF)	WR169	24	313	348	331	14.3	-
477		Tyler Badie (DEN)	RB123	26	279	317	298	19	-
478		Ty Chandler (MIN)	RB124	27	297	301	299	2	-
479		Miami Dolphins (MIA)	DST20	-	278	323	300.5	22.5	-
480		Sterling Shepard (TB)	WR170	33	274	399	334.3	51.1	-
481		Brock Wright (DET)	TE71	27	338	388	353	20.4	-
482		New Orleans Saints (NO)	DST21	-	270	347	308.5	38.5	-
483		Isaiah Hodgins (NYG)	WR171	27	301	316	308.5	7.5	-
484		Chicago Bears (CHI)	DST22	-	306	319	312.5	6.5	-
485		George Holani (SEA)	RB125	26	308	387	357	29.9	-
486		Daniel Bellinger (NYG)	TE72	25	335	389	365.8	20.2	-
487		Isaiah Williams (NYJ)	WR172	25	314	319	316.5	2.5	-
488		Andy Dalton (CAR)	QB76	38	265	370	317.5	52.5	-
489		Charlie Kolar (BAL)	TE73	27	320	393	361.3	26.6	-
490		Josh Reynolds (NYJ)	WR173	31	272	389	330.5	58.5	-
491		Jason Sanders (MIA)	K22	30	332	332	332	0	-
492		Jeremy Ruckert (NYJ)	TE74	25	342	391	366.5	21.7	-
493		Cam Akers (SEA)	RB126	26	309	357	333	24	-
494		Alexander Mattison (MIA)	RB127	27	298	369	333.5	35.5	-
495		Jaydn Ott (FA)	RB128	-	339	368	358	13.4	-
496		Jackson Hawes (BUF)	TE75	25	342	385	360.3	18.1	-
497		Mitch Tinsley (CIN)	WR174	26	352	377	365	10.2	-
498		Jacob Cowing (SF)	WR175	25	340	355	347.5	7.5	-
499		Sam Roush (FA)	TE76	-	348	354	351	3	-
500		Arian Smith (NYJ)	WR176	24	338	365	351.5	13.5	-
501		Hunter Long (JAC)	TE77	27	336	392	369	23.9	-
502		Eli Raridon (FA)	TE78	-	351	365	358	7	-
503		David Sills V (ATL)	WR177	29	346	376	361	15	-
504		Dallen Bentley (FA)	TE79	-	352	370	361	9	-
505		Sam Howell (PHI)	QB77	25	350	398	381.8	19.2	-
506		John Bates (WAS)	TE80	28	331	396	363.5	32.5	-
507		Marlin Klein (FA)	TE81	-	352	376	364	12	-
508		Kaelon Black (FA)	RB129	-	341	388	364.5	23.5	-
509		Oscar Delp (FA)	TE82	-	373	374	373.5	0.5	-"""

ALIASES = {
    "Patrick Mahomes II": "Patrick Mahomes",
    "Deebo Samuel Sr.": "Deebo Samuel",
    "Aaron Jones Sr.": "Aaron Jones",
    "Anthony Richardson Sr.": "Anthony Richardson",
    "Chris Godwin Jr.": "Chris Godwin",
    "Brian Thomas Jr.": "Brian Thomas",
    "Kyle Pitts Sr.": "Kyle Pitts",
    "Michael Pittman Jr.": "Michael Pittman",
    "Marvin Harrison Jr.": "Marvin Harrison",
    "Ollie Gordon II": "Ollie Gordon",
    "Chris Rodriguez Jr.": "Chris Rodriguez",
    "Jonathon Brooks": "Jonathan Brooks",
    "Travis Etienne Jr.": "Travis Etienne",
    "Michael Penix Jr.": "Michael Penix",
    "Thomas Fidone II": "Thomas Fidone",
    "Erick All Jr.": "Erick All",
}


def extract_name(raw: str) -> str:
    raw = raw.strip()
    m = re.match(r"^(.+?)\s*\((?:FA|[A-Z]{2,3})\)\s*$", raw)
    if m:
        return m.group(1).strip()
    return raw


def extract_position(pos_col: str) -> str:
    pos_col = pos_col.strip().upper()
    if pos_col.startswith("DST"):
        return "D/ST"
    if len(pos_col) >= 2 and pos_col[:2] in ("QB", "RB", "WR", "TE"):
        return pos_col[:2]
    return pos_col[:1] if pos_col else ""


def parse() -> list[tuple[int, str, str, float, bool]]:
    """Parse tab-separated. Col 2=name, 3=POS, 7=AVG (dynasty has AGE col at 4)."""
    lines = RAW.strip().split("\n")
    rows = []
    for line in lines:
        line = line.strip()
        if not line or "RK" in line or "Tier" in line or "Customize" in line:
            continue
        parts = line.split("\t")
        if len(parts) < 8:
            continue
        try:
            rk = int(parts[0].strip())
        except ValueError:
            continue
        name_raw = parts[2].strip()
        name = extract_name(name_raw)
        if not name:
            continue
        pos = extract_position(parts[3])
        try:
            avg = float(parts[7].strip())
        except (ValueError, IndexError):
            avg = float(rk)
        is_fa = "(FA)" in name_raw
        rows.append((rk, name, pos, avg, is_fa))
    return rows


def esc(s: str) -> str:
    return s.replace("'", "''")


def generate_migration() -> str:
    rows = parse()
    values_lines = [
        f"    ('{esc(name)}', '{pos}', {avg}::numeric, {str(is_fa).lower()})"
        for _, name, pos, avg, is_fa in rows
    ]
    values_sql = ",\n".join(values_lines)
    alias_lines = [f"    ('{esc(k)}', '{esc(v)}')" for k, v in ALIASES.items()]
    alias_sql = ",\n".join(alias_lines)

    return f"""-- PPR / dynasty / non-superflex baseline rankings
-- Inserts into baseline_community_rankings (matches players by name, season=2025)
-- Adds FA rookies to baseline_rookies if not in players or already in baseline_rookies

WITH parsed (input_name, position, avg_rank, is_fa) AS (
  VALUES
{values_sql}
),
aliases (input_name, db_name) AS (
  VALUES
{alias_sql}
),
lookup AS (
  SELECT
    p.input_name,
    p.position,
    p.avg_rank,
    p.is_fa,
    COALESCE(a.db_name, p.input_name) AS match_name
  FROM parsed p
  LEFT JOIN aliases a ON a.input_name = p.input_name
),

ins_baseline AS (
  INSERT INTO public.baseline_community_rankings (scoring_format, league_type, is_superflex, player_id, rank)
  SELECT
    'ppr'::text,
    'dynasty'::text,
    false,
    pl.id,
    l.avg_rank
  FROM lookup l
  INNER JOIN public.players pl ON pl.name = l.match_name AND pl.season = 2025
  ON CONFLICT (scoring_format, league_type, is_superflex, player_id)
  DO UPDATE SET rank = EXCLUDED.rank
)

INSERT INTO public.baseline_rookies (name, position, rank, scoring_format, league_type, is_superflex)
SELECT l.input_name, l.position, l.avg_rank, 'ppr'::text, 'dynasty'::text, false
FROM lookup l
WHERE l.is_fa = true
  AND NOT EXISTS (
    SELECT 1 FROM public.players p
    WHERE (p.name = l.match_name OR p.name = l.input_name) AND p.season = 2025
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.baseline_rookies br
    WHERE br.name = l.input_name
      AND br.scoring_format = 'ppr'
      AND br.league_type = 'dynasty'
      AND br.is_superflex = false
  )
ON CONFLICT (scoring_format, league_type, is_superflex, name) DO NOTHING;
"""


def main():
    rows = parse()
    fa_count = sum(1 for r in rows if r[4])
    if len(sys.argv) > 1 and sys.argv[1] == "--migration":
        out = generate_migration()
        out_path = "supabase/migrations/20260219220000_ppr_dynasty_non_sf_baseline.sql"
        with open(out_path, "w") as f:
            f.write(out)
        print(f"Wrote migration to {out_path}")
        print(f"Parsed {len(rows)} rows, {fa_count} FA players")
    else:
        print("-- PPR/dynasty/non-superflex baseline: parsed", len(rows), "rows, FA:", fa_count)
        print("Run with --migration to generate migration file")


if __name__ == "__main__":
    main()
