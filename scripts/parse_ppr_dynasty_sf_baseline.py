#!/usr/bin/env python3
"""
Parse PPR/dynasty/superflex baseline rankings and output SQL for migration.
Format: RK, WSID, Player Name, POS, AGE, BEST, WORST, AVG - use column 7 (AVG).
FA players -> baseline_rookies for ppr/dynasty/superflex if not in players.
"""

import re
import sys

# Raw data: tab-separated. Cols: RK, WSID, Player Name, POS, AGE, BEST, WORST, AVG (index 7)
RAW = """1		Josh Allen (BUF)	QB1	29	1	3	1.3	0.6	-
2		Drake Maye (NE)	QB2	23	1	6	2.4	1.1	-
3		Jayden Daniels (WAS)	QB3	25	2	11	5.5	2.8	-
4		Joe Burrow (CIN)	QB4	29	3	19	6.5	4.2	-
5		Ja'Marr Chase (CIN)	WR1	25	3	8	6.8	1.6	-
6		Lamar Jackson (BAL)	QB5	29	2	31	7.7	9.1	-
7		Puka Nacua (LAR)	WR2	24	5	13	8.7	2	-
8		Jaxon Smith-Njigba (SEA)	WR3	24	6	19	9.7	2.5	-
9		Patrick Mahomes II (KC)	QB6	30	4	24	10.3	6.1	-
10		Jalen Hurts (PHI)	QB7	27	3	29	11.3	6.7	-
11		Bijan Robinson (ATL)	RB1	24	8	18	14.2	3.9	-
12		Caleb Williams (CHI)	QB8	24	4	56	14.3	11.6	-
13		Justin Herbert (LAC)	QB9	27	6	35	14.3	7	-
14		Jahmyr Gibbs (DET)	RB2	23	9	19	15.8	3.6	-
15		CeeDee Lamb (DAL)	WR4	26	7	22	15.9	4.9	-
16		Justin Jefferson (MIN)	WR5	26	9	22	16.3	3.8	-
17		Amon-Ra St. Brown (DET)	WR6	26	10	29	18.8	5.2	-
18		Jaxson Dart (NYG)	QB10	22	12	41	19.6	8.5	-
19		Malik Nabers (NYG)	WR7	22	9	29	20.9	5.4	-
20		Ashton Jeanty (LV)	RB3	22	15	29	22.3	3.8	-
21		Brock Purdy (SF)	QB11	26	12	44	22.9	9.4	-
22		Bo Nix (DEN)	QB12	26	14	50	23.4	10.1	-
23		Drake London (ATL)	WR8	24	15	30	23.9	5.1	-
24		De'Von Achane (MIA)	RB4	24	17	31	24.3	3.6	-
25		Trevor Lawrence (JAC)	QB13	26	11	60	25.7	12.7	-
26		Jonathan Taylor (IND)	RB5	27	18	38	29.1	5.4	-
27		Nico Collins (HOU)	WR9	26	20	40	29.2	5.5	-
28		James Cook III (BUF)	RB6	26	20	41	29.4	5	-
29		Omarion Hampton (LAC)	RB7	22	21	39	31.4	5.3	-
30		George Pickens (DAL)	WR10	24	18	41	31.9	6	-
31		Jordan Love (GB)	QB14	27	13	68	32.4	16	-
32		Tetairoa McMillan (CAR)	WR11	22	23	45	32.9	5.2	-
33		Brock Bowers (LV)	TE1	23	15	44	35	7.5	-
34		Rashee Rice (KC)	WR12	25	23	53	36	6.2	-
35		Dak Prescott (DAL)	QB15	32	20	61	36.4	13.8	-
36		Trey McBride (ARI)	TE2	26	13	49	37	9.1	-
37		Garrett Wilson (NYJ)	WR13	25	28	45	37.3	4.2	-
38		Jeremiyah Love (FA)	RB8	20	20	74	38.4	22.1	-
39		Chris Olave (NO)	WR14	25	25	51	38.5	7.1	-
40		Ladd McConkey (LAC)	WR15	24	34	50	41.7	3.9	-
41		Baker Mayfield (TB)	QB16	30	20	65	42.8	15.1	-
42		Emeka Egbuka (TB)	WR16	23	33	80	43.6	10.4	-
43		A.J. Brown (PHI)	WR17	28	33	72	46.7	10.4	-
44		Tee Higgins (CIN)	WR18	27	36	62	47.1	6.8	-
45		Breece Hall (NYJ)	RB9	24	32	75	48	12.6	-
46		Bucky Irving (TB)	RB10	23	36	64	49.3	9.4	-
47		C.J. Stroud (HOU)	QB17	24	25	92	49.4	15.1	-
48		Jordyn Tyson (FA)	WR19	21	47	55	50	3.1	-
49		Carnell Tate (FA)	WR20	21	40	81	51.8	15.1	-
50		Fernando Mendoza (FA)	QB18	22	45	56	52	3.7	-
51		Zay Flowers (BAL)	WR21	25	37	69	52.5	8.2	-
52		Brian Thomas Jr. (JAC)	WR22	23	35	91	52.9	13.4	-
53		TreVeyon Henderson (NE)	RB11	23	27	75	53	15	-
54		Rome Odunze (CHI)	WR23	23	45	74	53.5	8.9	-
55		Makai Lemon (FA)	WR24	21	46	70	54.4	8.4	-
56		Jameson Williams (DET)	WR25	24	42	85	54.8	11.1	-
57		DeVonta Smith (PHI)	WR26	27	41	74	54.9	9.8	-
58		Chase Brown (CIN)	RB12	25	36	70	55.6	9.8	-
59		Colston Loveland (CHI)	TE3	21	35	65	56.6	6.4	-
60		Marvin Harrison Jr. (ARI)	WR27	23	38	91	57	13.9	-
61		Jared Goff (DET)	QB19	31	24	78	57.3	13.7	-
62		Luther Burden III (CHI)	WR28	22	27	99	58.5	16.8	-
63		Jaylen Waddle (MIA)	WR29	27	40	77	58.8	9.4	-
64		Christian McCaffrey (SF)	RB13	29	34	75	59.4	12.4	-
65		Saquon Barkley (PHI)	RB14	29	23	78	59.8	15.7	-
66		Tyler Warren (IND)	TE4	23	54	70	60.7	4.4	-
67		Sam Darnold (SEA)	QB20	28	36	93	62.2	14.2	-
68		Tucker Kraft (GB)	TE5	25	59	87	65.8	7.8	-
69		Harold Fannin Jr. (CLE)	TE6	21	51	82	66.8	7	-
70		Quinshon Judkins (CLE)	RB15	22	50	83	67.2	8.6	-
71		Kenneth Walker III (SEA)	RB16	25	39	83	67.5	11.8	-
72		Kyren Williams (LAR)	RB17	25	39	92	68.2	11.7	-
73		Sam LaPorta (DET)	TE7	25	59	106	70	10.2	-
74		Cam Ward (TEN)	QB21	23	33	117	70.3	17.5	-
75		Josh Jacobs (GB)	RB18	28	45	88	70.3	10.4	-
76		RJ Harvey (DEN)	RB19	25	48	101	71.5	11.8	-
77		Kyle Pitts Sr. (ATL)	TE8	25	63	94	76.3	9.5	-
78		Jordan Addison (MIN)	WR30	24	55	100	77	13.2	-
79		DK Metcalf (PIT)	WR31	28	57	105	78.3	12	-
80		Cam Skattebo (NYG)	RB20	24	65	89	79.5	7.4	-
81		Kyler Murray (ARI)	QB22	28	50	105	81	15.4	-
82		Denzel Boston (FA)	WR32	22	80	85	82.8	1.8	-
83		Travis Etienne Jr. (JAC)	RB21	27	69	107	83.9	10.9	-
84		Ricky Pearsall (SF)	WR33	25	76	102	84	7.7	-
85		Christian Watson (GB)	WR34	26	51	111	85	17.6	-
86		Tyler Shough (NO)	QB23	26	50	153	85.4	23.9	-
87		Travis Hunter (JAC)	WR35	22	50	135	89.1	25	-
88		Javonte Williams (DAL)	RB22	25	68	108	90.4	11.8	-
89		Bryce Young (CAR)	QB24	24	66	137	90.7	15.6	-
90		Dalton Kincaid (BUF)	TE9	26	78	119	91.1	11.1	-
91		J.J. McCarthy (MIN)	QB25	23	55	150	92.3	21.8	-
92		Terry McLaurin (WAS)	WR36	30	56	116	92.5	14.1	-
93		Courtland Sutton (DEN)	WR37	30	63	139	94	19.8	-
94		Matthew Stafford (LAR)	QB26	38	71	111	94.1	9.7	-
95		Michael Pittman Jr. (IND)	WR38	28	79	113	95	12.3	-
96		Derrick Henry (BAL)	RB23	32	73	132	95.2	14.1	-
97		Oronde Gadsden II (LAC)	TE10	22	70	142	95.3	22.6	-
98		Xavier Worthy (KC)	WR39	22	70	143	95.5	19.4	-
99		Michael Penix Jr. (ATL)	QB27	25	72	120	97.8	10.9	-
100		Davante Adams (LAR)	WR40	33	73	129	99.3	14.3	-
101		Daniel Jones (IND)	QB28	28	71	138	100.6	15.4	-
102		Jakobi Meyers (JAC)	WR41	29	77	140	100.8	15.8	-
103		Michael Wilson (ARI)	WR42	26	47	128	101	17.7	-
104		DJ Moore (CHI)	WR43	28	66	136	103.4	18.7	-
105		Wan'Dale Robinson (NYG)	WR44	25	73	128	103.6	13.4	-
106		D'Andre Swift (CHI)	RB24	27	85	130	103.8	11.6	-
107		Jake Ferguson (DAL)	TE11	27	81	133	104.5	18	-
108		Jayden Higgins (HOU)	WR45	23	78	130	104.6	14.7	-
109		K.C. Concepcion (FA)	WR46	21	79	132	110.7	21.2	-
110		Alec Pierce (IND)	WR47	25	79	197	111	26.8	-
111		Jonah Coleman (FA)	RB25	22	81	140	111.8	21.8	-
112		George Kittle (SF)	TE12	32	61	189	111.8	35	-
113		Quentin Johnston (LAC)	WR48	24	86	159	112.5	17.1	-
114		Kenyon Sadiq (FA)	TE13	20	80	154	112.5	27.1	-
115		Khalil Shakir (BUF)	WR49	26	82	135	113.8	13	-
116		Jaylen Warren (PIT)	RB26	27	97	144	114.3	15.5	-
117		Brenton Strange (JAC)	TE14	25	79	193	114.4	25.7	-
118		Brandon Aiyuk (SF)	WR50	27	82	182	116.5	19.1	-
119		Kyle Monangai (CHI)	RB27	23	97	150	117.8	14.7	-
120		Zach Charbonnet (SEA)	RB28	25	99	151	118.8	16.6	-
121		Jayden Reed (GB)	WR51	25	86	151	119	15.2	-
122		Eli Stowers (FA)	TE15	22	95	170	119.5	25.2	-
123		Mike Evans (TB)	WR52	32	91	163	120.5	14.6	-
124		Matthew Golden (GB)	WR53	22	98	144	120.5	11.9	-
125		Jauan Jennings (SF)	WR54	28	96	152	121.5	15.3	-
126		Chris Godwin Jr. (TB)	WR55	30	105	181	125.2	16.9	-
127		Josh Downs (IND)	WR56	24	107	148	125.3	13.8	-
128		Blake Corum (LAR)	RB29	25	86	167	127.2	20.7	-
129		Woody Marks (HOU)	RB30	25	100	167	127.5	23.2	-
130		Trey Benson (ARI)	RB31	23	94	165	128.4	21.7	-
131		Stefon Diggs (NE)	WR57	32	107	162	128.9	15.9	-
132		Bhayshul Tuten (JAC)	RB32	24	96	168	130.8	19.7	-
133		Rhamondre Stevenson (NE)	RB33	28	87	162	133.9	21.6	-
134		Mason Taylor (NYJ)	TE16	21	101	178	134.9	19.1	-
135		Rico Dowdle (CAR)	RB34	27	107	171	135.6	18.8	-
136		Parker Washington (JAC)	WR58	23	88	215	135.7	28.5	-
137		Dallas Goedert (PHI)	TE17	31	103	183	138.9	20.4	-
138		Jalen Coker (CAR)	WR59	24	97	180	141.3	22.4	-
139		Troy Franklin (DEN)	WR60	23	108	212	141.7	28.3	-
140		Ty Simpson (FA)	QB29	23	132	157	143.3	9.4	-
141		Chuba Hubbard (CAR)	RB35	26	104	190	143.6	21.2	-
142		Theo Johnson (NYG)	TE18	24	124	188	144.8	17.7	-
143		David Montgomery (DET)	RB36	28	98	189	145.9	24.6	-
144		Terrance Ferguson (LAR)	TE19	22	89	203	146.2	30.9	-
145		Deebo Samuel Sr. (WAS)	WR61	30	119	249	147.2	30	-
146		Romeo Doubs (GB)	WR62	25	123	184	147.5	15.6	-
147		Tyreek Hill (FA)	WR63	31	82	205	147.8	32.5	-
148		Tyrone Tracy Jr. (NYG)	RB37	26	111	186	149.3	18.8	-
149		Tre Harris (LAC)	WR64	23	109	226	150.1	28.8	-
150		Tyler Allgeier (ATL)	RB38	25	111	198	151.4	22.6	-
151		Rashid Shaheed (SEA)	WR65	27	119	194	151.6	19.8	-
152		Jalen McMillan (TB)	WR66	24	109	186	152.1	21.5	-
153		Malik Willis (GB)	QB30	26	52	159	116.9	32.7	-
154		Mark Andrews (BAL)	TE20	30	81	234	155.1	30.4	-
155		Juwan Johnson (NO)	TE21	29	126	192	155.2	22	-
156		Jerry Jeudy (CLE)	WR67	26	118	273	155.3	34.8	-
157		Isaiah Likely (BAL)	TE22	25	125	197	155.8	23.1	-
158		Jacory Croskey-Merritt (WAS)	RB39	24	134	201	160.3	14.3	-
159		Tua Tagovailoa (MIA)	QB31	27	87	188	124.6	23.8	-
160		Tony Pollard (TEN)	RB40	28	117	200	160.6	22.7	-
161		Elic Ayomanor (TEN)	WR68	22	142	181	160.8	12.8	-
162		T.J. Hockenson (MIN)	TE23	28	124	218	161.3	26	-
163		Jaylin Noel (HOU)	WR69	23	106	231	161.8	28.5	-
164		Michael Trigg (FA)	TE24	-	141	189	162.2	16.2	-
165		Omar Cooper Jr. (FA)	WR70	22	114	274	162.8	56	-
166		Kayshon Boutte (NE)	WR71	23	115	217	163.4	22.3	-
167		Kenneth Gainwell (PIT)	RB41	26	115	259	165.1	30	-
168		Pat Bryant (DEN)	WR72	23	104	233	165.4	28.2	-
169		Adonai Mitchell (NYJ)	WR73	23	126	256	166.9	30.8	-
170		Jadarian Price (FA)	RB42	22	102	268	167.6	53.9	-
171		Malachi Fields (FA)	WR74	-	126	234	168.4	36.3	-
172		Hunter Henry (NE)	TE25	31	127	194	168.6	19.1	-
173		Chris Brazzell II (FA)	WR75	-	149	197	171	19.4	-
174		Shedeur Sanders (CLE)	QB32	24	99	182	138.1	20.8	-
175		Mike Washington Jr. (FA)	RB43	-	112	225	173.6	36.1	-
176		Tyjae Spears (TEN)	RB44	24	144	223	173.9	17.3	-
177		J.K. Dobbins (DEN)	RB45	27	116	222	175.3	25.4	-
178		Dalton Schultz (HOU)	TE26	29	132	206	177.3	24	-
179		Alvin Kamara (NO)	RB46	30	135	267	178.8	28.8	-
180		AJ Barner (SEA)	TE27	23	127	222	170.1	33.3	-
181		Kyle Williams (NE)	WR76	23	144	258	180	27.5	-
182		David Njoku (CLE)	TE28	29	146	215	180.9	17.5	-
183		Kaleb Johnson (PIT)	RB47	22	113	244	181.2	25.3	-
184		Chimere Dike (TEN)	WR77	24	135	295	181.9	39.1	-
185		Keon Coleman (BUF)	WR78	22	132	253	182.3	32.1	-
186		Tory Horton (SEA)	WR79	23	159	231	183.2	16.4	-
187		Germie Bernard (FA)	WR80	22	154	242	184.3	34.7	-
188		Elijah Arroyo (SEA)	TE29	22	161	223	185.9	18.3	-
189		Elijah Sarratt (FA)	WR81	22	129	280	186.8	47.8	-
190		Darnell Mooney (ATL)	WR82	28	135	263	187.1	34.1	-
191		Jordan Mason (MIN)	RB48	26	165	254	187.9	23.6	-
192		Isaac TeSlaa (DET)	WR83	24	145	247	188.5	26.1	-
193		Chris Bell (FA)	WR84	-	136	281	188.7	46.5	-
194		Dylan Sampson (CLE)	RB49	21	164	221	188.7	16.1	-
195		Zachariah Branch (FA)	WR85	21	157	236	189.8	30.9	-
196		Emmett Johnson (FA)	RB50	22	109	273	190.9	49.9	-
197		Aaron Jones Sr. (MIN)	RB51	31	143	229	191.9	23.3	-
198		Calvin Ridley (TEN)	WR86	31	123	282	193.3	40.2	-
199		Antonio Williams (FA)	WR87	21	175	217	193.4	14.7	-
200		Rachaad White (TB)	RB52	27	164	234	193.6	19.1	-
201		Travis Kelce (KC)	TE30	36	131	259	194.9	29.4	-
202		James Conner (ARI)	RB53	30	136	240	195.2	25.4	-
203		Tank Dell (HOU)	WR88	26	154	264	195.5	25.1	-
204		Marvin Mims Jr. (DEN)	WR89	23	152	249	196.6	27.5	-
205		Isiah Pacheco (KC)	RB54	26	150	268	196.7	25.5	-
206		Brian Robinson Jr. (SF)	RB55	26	144	244	197	29.6	-
207		Anthony Richardson Sr. (IND)	QB33	23	106	277	143	40.1	-
208		Braelon Allen (NYJ)	RB56	22	154	274	198.5	23.7	-
209		Tank Bigsby (PHI)	RB57	23	171	254	199.8	19.9	-
210		Ja'Kobi Lane (FA)	WR90	21	154	240	200	25.7	-
211		Pat Freiermuth (PIT)	TE31	27	153	273	202.3	29.6	-
212		Jonathon Brooks (CAR)	RB58	22	134	270	202.7	33.7	-
213		Cade Otton (TB)	TE32	26	162	270	204.1	23.9	-
214		Kimani Vidal (LAC)	RB59	24	158	251	204.3	23.4	-
215		Chig Okonkwo (TEN)	TE33	26	133	277	204.6	30.4	-
216		Devin Neal (NO)	RB60	22	159	282	206.4	28.7	-
217		Dontayvion Wicks (GB)	WR91	24	176	248	207.6	23.9	-
218		Rashod Bateman (BAL)	WR92	26	160	255	200.4	29.7	-
219		Christian Kirk (HOU)	WR93	29	145	277	210.8	33.7	-
220		Evan Engram (DEN)	TE34	31	123	272	211.3	30.5	-
221		Kaytron Allen (FA)	RB61	23	147	272	211.5	32.9	-
222		Nicholas Singleton (FA)	RB62	22	179	238	213.2	21.1	-
223		Justin Fields (NYJ)	QB34	26	106	217	148.8	30.7	-
224		Cedric Tillman (CLE)	WR94	25	156	269	206.1	32.2	-
225		Jack Bech (LV)	WR95	23	141	267	207	32.9	-
226		Mac Jones (SF)	QB35	27	130	210	152.1	23.9	-
227		Cooper Kupp (SEA)	WR96	32	145	315	216.3	39.7	-
228		Xavier Legette (CAR)	WR97	25	157	305	211.9	36.8	-
229		Ray Davis (BUF)	RB63	26	158	274	221.3	27.5	-
230		Ollie Gordon II (MIA)	RB64	22	173	273	221.4	23.7	-
231		Keenan Allen (LAC)	WR98	33	180	316	215.7	32.1	-
232		Tez Johnson (TB)	WR99	23	178	273	223.1	22.5	-
233		Geno Smith (LV)	QB36	35	146	235	165	29	-
234		Sean Tucker (TB)	RB65	24	178	277	225.3	23.9	-
235		Tre Tucker (LV)	WR100	24	172	256	218.2	20.3	-
236		Michael Mayer (LV)	TE35	24	170	303	218.8	30.5	-
237		Jaylen Wright (MIA)	RB66	22	190	268	226.8	20.4	-
238		Ben Sinnott (WAS)	TE36	23	164	273	213.1	27.9	-
239		Marquise Brown (KC)	WR101	28	177	307	221.6	38.6	-
240		Malik Washington (MIA)	WR102	25	188	265	223.4	18.6	-
241		DeMario Douglas (NE)	WR103	25	180	294	224.2	34	-
242		Darius Slayton (NYG)	WR104	29	194	290	228	21.6	-
243		Devaughn Vele (NO)	WR105	28	208	314	234.4	27.5	-
244		Keaton Mitchell (BAL)	RB67	24	190	288	234.7	25.2	-
245		Demond Claiborne (FA)	RB68	22	214	264	242	19.2	-
246		Kendre Miller (NO)	RB69	23	158	288	237.7	27.1	-
247		Skyler Bell (FA)	WR106	23	226	282	245.4	19.1	-
248		Najee Harris (LAC)	RB70	27	166	327	239.3	32.5	-
249		Joe Mixon (HOU)	RB71	29	153	280	235.1	30.5	-
250		Gunnar Helm (TEN)	TE37	23	146	231	199	24.5	-
251		Jaydon Blue (DAL)	RB72	22	198	283	243.3	24.8	-
252		Jalen Royals (KC)	WR107	23	184	348	245.2	35.5	-
253		Isaiah Bond (CLE)	WR108	21	186	347	245.8	38	-
254		Brashard Smith (KC)	RB73	22	198	320	246.8	25.6	-
255		Isaiah Davis (NYJ)	RB74	24	192	292	247.6	24.3	-
256		Chris Rodriguez Jr. (WAS)	RB75	26	174	300	244.5	31.7	-
257		Joshua Palmer (BUF)	WR109	26	185	325	238.7	34.4	-
258		Emanuel Wilson (GB)	RB76	26	164	292	240.7	33.3	-
259		Roman Wilson (PIT)	WR110	24	212	329	249.9	32	-
260		Adam Randall (FA)	RB77	-	202	311	262.2	39.8	-
261		Andrei Iosivas (CIN)	WR111	26	209	313	245.2	29.2	-
262		Cole Kmet (CHI)	TE38	26	186	316	240.4	34.4	-
263		DJ Giddens (IND)	RB78	22	219	357	260.2	32.5	-
264		Aaron Rodgers (PIT)	QB37	42	146	211	167	25.4	-
265		Ryan Flournoy (DAL)	WR112	26	173	258	233.3	20.4	-
266		Roman Hemby (FA)	RB79	23	218	314	266.5	34.2	-
267		Isaac Guerendo (SF)	RB80	25	195	342	267.1	35.2	-
268		Jarquez Hunter (LAR)	RB81	23	234	367	267.3	33.5	-
269		Calvin Austin III (PIT)	WR113	26	228	334	251.9	28.6	-
270		Ja'Tavion Sanders (CAR)	TE39	22	206	327	245	28.5	-
271		Jonnu Smith (PIT)	TE40	30	209	303	252.9	31.8	-
272		Colby Parkinson (LAR)	TE41	27	162	258	228	26.4	-
273		Dont'e Thornton Jr. (LV)	WR114	23	215	287	247.5	21.9	-
274		Will Shipley (PHI)	RB82	23	247	342	268.6	22.1	-
275		Kareem Hunt (KC)	RB83	30	228	333	261.2	23.4	-
276		Jordan Whittington (LAR)	WR115	25	232	354	267.3	33.5	-
277		Nick Chubb (HOU)	RB84	30	231	288	262.2	14.4	-
278		Audric Estime (NO)	RB85	22	212	284	255.5	21.2	-
279		Jake Tonges (SF)	TE42	26	170	291	230.9	32.7	-
280		Jaylin Lane (WAS)	WR116	23	235	352	264.4	34.5	-
281		Devin Singletary (NYG)	RB86	28	221	307	259.5	21	-
282		Tahj Brooks (CIN)	RB87	23	250	319	277.2	20.8	-
283		Luke McCaffrey (WAS)	WR117	24	227	333	260.1	33.8	-
284		Mike Gesicki (CIN)	TE43	30	207	286	245.9	23.4	-
285		Jerome Ford (CLE)	RB88	26	205	316	269.2	26.5	-
286		Trevor Etienne (CAR)	RB89	21	254	358	275.7	26.2	-
287		Jalen Milroe (SEA)	QB38	23	147	276	179.1	42.2	-
288		John Metchie III (NYJ)	WR118	25	214	334	253.4	34.8	-
289		Jacoby Brissett (ARI)	QB39	33	124	277	184.5	54.6	-
290		Darnell Washington (PIT)	TE44	24	220	281	248.8	19.6	-
291		Jordan James (SF)	RB90	21	257	328	278.8	16.7	-
292		MarShawn Lloyd (GB)	RB91	25	250	331	274.5	18.9	-
293		Jaleel McLaughlin (DEN)	RB92	25	225	318	276.4	25	-
294		Jalen Nailor (MIN)	WR119	26	226	328	265.1	31.4	-
295		Michael Carter (ARI)	RB93	26	187	302	267.4	26.8	-
296		Kirk Cousins (ATL)	QB40	37	150	240	185	34.8	-
297		Savion Williams (GB)	WR120	24	241	320	267.7	24.3	-
298		Justice Hill (BAL)	RB94	28	226	345	279	29.3	-
299		Noah Gray (KC)	TE45	26	226	364	271.3	35.6	-
300		Bam Knight (ARI)	RB95	24	186	336	267.4	40.3	-
301		Jalen Tolbert (DAL)	WR121	26	239	339	268.2	32.5	-
302		KeAndre Lambert-Smith (LAC)	WR122	24	240	320	269.4	25.8	-
303		DeAndre Hopkins (BAL)	WR123	33	208	335	261.5	41.7	-
304		LeQuint Allen Jr. (JAC)	RB96	21	253	341	279.8	25.6	-
305		Darren Waller (MIA)	TE46	33	226	289	257.4	21	-
306		Roschon Johnson (CHI)	RB97	25	251	314	277.1	18.3	-
307		Jameis Winston (NYG)	QB41	32	147	304	205	64.8	-
308		Ty Johnson (BUF)	RB98	28	264	338	284.8	23.8	-
309		Luke Musgrave (GB)	TE47	25	248	299	273.6	16	-
310		Noah Fant (CIN)	TE48	28	239	319	275.9	25.5	-
311		Elijah Moore (FA)	WR124	25	235	348	267.7	34.8	-
312		Max Klare (FA)	TE49	-	134	202	156.5	26.8	-
313		Dawson Knox (BUF)	TE50	29	240	302	275.1	20.2	-
314		Quinn Ewers (MIA)	QB42	22	158	278	208.8	46.6	-
315		Russell Wilson (NYG)	QB43	37	137	298	210.4	66.5	-
316		Konata Mumpfield (LAR)	WR125	23	228	275	254.6	16.2	-
317		Tyler Lockett (LV)	WR126	33	231	362	268.6	41.2	-
318		Xavier Restrepo (TEN)	WR127	23	240	344	282.3	36.9	-
319		Mack Hollins (NE)	WR128	32	227	331	272.5	31.4	-
320		Tyler Higbee (LAR)	TE51	33	260	338	285.2	30.5	-
321		Greg Dulcich (MIA)	TE52	25	222	351	275.9	40.3	-
322		Jack Endries (FA)	TE53	-	160	272	223.2	43.1	-
323		Ted Hurst (FA)	WR129	-	152	227	195	28.1	-
324		Zach Ertz (WAS)	TE54	35	204	337	269	37.8	-
325		Marcus Mariota (WAS)	QB44	32	156	322	232.4	63.2	-
326		Austin Ekeler (WAS)	RB99	30	265	360	291.2	28.4	-
327		Samaje Perine (CIN)	RB100	30	242	350	282.6	39.7	-
328		Tyrod Taylor (NYJ)	QB45	36	184	290	235.8	40.9	-
329		Tyquan Thornton (KC)	WR130	25	209	330	272.9	34.9	-
330		Miles Sanders (DAL)	RB101	28	247	354	287.4	30.9	-
331		Spencer Rattler (NO)	QB46	25	150	340	241.8	65.4	-
332		Joe Flacco (CIN)	QB47	41	147	332	212	71.2	-
333		Cade Stover (HOU)	TE55	25	253	389	306.6	40.5	-
334		Demarcus Robinson (SF)	WR131	31	243	345	280.9	36.5	-
335		Antonio Gibson (NE)	RB102	27	246	366	291.5	32.6	-
336		Raheim Sanders (CLE)	RB103	23	254	344	291.5	32.2	-
337		Ja'Lynn Polk (NO)	WR132	23	211	295	250.2	28.1	-
338		Brandin Cooks (BUF)	WR133	32	233	345	293.1	41.6	-
339		Taysom Hill (NO)	TE56	35	240	292	265.2	18.6	-
340		Phil Mafah (DAL)	RB104	23	203	312	266.2	41.8	-
341		Jawhar Jordan (HOU)	RB105	26	236	262	245	10.1	-
342		Will Howard (PIT)	QB48	24	167	322	246.8	61.7	-
343		Kevin Coleman Jr. (FA)	WR134	-	196	242	213.3	20.4	-
344		Gabe Davis (BUF)	WR135	26	236	368	290.2	48.5	-
345		Chris Brooks (GB)	RB106	26	266	308	290.8	16	-
346		Jermaine Burton (FA)	WR136	24	239	355	276.6	42	-
347		Tai Felton (MIN)	WR137	22	257	335	301.9	23.9	-
348		Diontae Johnson (FA)	WR138	29	185	254	220.3	28.2	-
349		Kendrick Bourne (SF)	WR139	30	262	321	278.2	21.8	-
350		Emari Demercado (ARI)	RB107	27	230	271	257.5	16.6	-
351		Tyren Montgomery (FA)	WR140	-	207	235	223.3	11.9	-
352		Eric McAlister (FA)	WR141	-	208	243	228	14.7	-
353		Tanner Koziol (FA)	TE57	-	164	266	229.7	46.5	-
354		Tutu Atwell (LAR)	WR142	26	272	328	297.3	20.3	-
355		Dillon Gabriel (CLE)	QB49	25	181	336	267.8	55.6	-
356		Malik Davis (DAL)	RB108	27	174	292	236.3	48.4	-
357		Rasheen Ali (BAL)	RB109	25	240	343	289.2	40	-
358		Erick All Jr. (CIN)	TE58	25	262	352	301.7	28.6	-
359		Justin Joly (FA)	TE59	-	219	258	239.7	16	-
360		Deion Burks (FA)	WR143	-	226	252	239.7	10.7	-
361		Malachi Corley (CLE)	WR144	23	237	354	289.8	38.9	-
362		Le'Veon Moss (FA)	RB110	-	238	299	273	25.3	-
363		Jared Wiley (KC)	TE60	25	230	303	275.8	28.9	-
364		Nick Westbrook-Ikhine (FA)	WR145	28	240	344	296.8	40	-
365		Jimmy Garoppolo (LAR)	QB50	34	183	211	197	14	-
366		Thomas Fidone II (NYG)	TE61	23	252	346	298.4	30.9	-
367		Treylon Burks (WAS)	WR146	25	253	355	298.4	37.8	-
368		Jahan Dotson (PHI)	WR147	25	276	333	309.3	20.9	-
369		Efton Chism III (NE)	WR148	24	290	312	301	7.3	-
370		Jarrett Stidham (DEN)	QB51	29	98	320	209	111	-
371		Brenen Thompson (FA)	WR149	-	238	299	260.7	27.3	-
372		Mitchell Evans (CAR)	TE62	22	271	386	317.7	40.3	-
373		KaVontae Turpin (DAL)	WR150	29	296	321	305.6	9.2	-
374		Jeremy McNichols (WAS)	RB111	30	232	302	268.3	28.6	-
375		Bryce Lance (FA)	WR151	-	191	255	223	32	-
376		Dameon Pierce (KC)	RB112	26	262	310	294.3	19.3	-
377		Mason Rudolph (PIT)	QB52	30	182	324	273	64.5	-
378		Greg Dortch (ARI)	WR152	27	258	328	295.8	25.2	-
379		Tanner McKee (PHI)	QB53	25	93	93	93	0	-
380		Xavier Hutchinson (HOU)	WR153	25	271	353	310.6	27.9	-
381		Austin Hooper (NE)	TE63	31	292	353	310.6	22.2	-
382		Seth McGowan (FA)	RB113	-	209	317	276	47.8	-
383		Damien Martinez (GB)	RB114	22	258	297	276	16.1	-
384		Will Levis (TEN)	QB54	26	170	295	232.5	62.5	-
385		Olamide Zaccheaus (CHI)	WR154	28	299	330	311.4	11.6	-
386		Dyami Brown (JAC)	WR155	26	280	351	312.2	24.2	-
387		Joe Milton III (DAL)	QB55	25	150	321	235.5	85.5	-
388		Jimmy Horn Jr. (CAR)	WR156	23	265	356	321.7	35.3	-
389		Gardner Minshew II (KC)	QB56	29	157	323	240	83	-
390		Philip Rivers (IND)	QB57	44	159	324	241.5	82.5	-
391		Brady Cook (NYJ)	QB58	24	160	326	243	83	-
392		JuJu Smith-Schuster (KC)	WR157	29	243	334	283.3	37.9	-
393		Tommy Tremble (CAR)	TE64	25	260	329	303.8	26.7	-
394		J'Mari Taylor (FA)	RB115	-	277	297	284	9.2	-
395		Noah Brown (WAS)	WR158	30	269	330	305	24.5	-
396		Tyler Huntley (BAL)	QB59	28	167	327	247	80	-
397		Joe Royer (FA)	TE65	-	190	309	249.5	59.5	-
398		Devontez Walker (BAL)	WR159	24	291	355	318.4	23.6	-
399		Robert Henry Jr. (FA)	RB116	-	192	310	251	59	-
400		Riley Leonard (IND)	QB60	23	223	279	251	28	-
401		Jam Miller (FA)	RB117	-	250	316	288.7	28.1	-
402		Trey Lance (LAC)	QB61	25	215	288	251.5	36.5	-
403		Will Dissly (LAC)	TE66	29	274	390	314.8	45.4	-
404		Josh Oliver (MIN)	TE67	28	286	357	319.6	28.9	-
405		Tyrell Shavers (BUF)	WR160	26	229	341	290.3	46.3	-
406		Elijah Higgins (ARI)	TE68	25	284	360	319.8	27.8	-
407		Khalil Herbert (NYJ)	RB118	27	255	316	291.7	26.4	-
408		Aidan O'Connell (LV)	QB62	27	178	334	256	78	-
409		Javon Baker (FA)	WR161	24	249	263	256	7	-
410		Raheem Mostert (LV)	RB119	33	252	261	256.5	4.5	-
411		Darius Cooper (PHI)	WR162	24	267	340	293.7	32.9	-
412		Davis Allen (LAR)	TE69	25	254	394	328.4	48	-
413		Davis Mills (HOU)	QB63	27	205	323	264	59	-
414		Zamir White (LV)	RB120	26	270	342	298	31.5	-
415		Elijah Mitchell (NE)	RB121	27	250	286	268	18	-
416		Theo Wease Jr. (MIA)	WR163	24	196	349	272.5	76.5	-
417		Charlie Kolar (BAL)	TE70	27	298	393	325.8	39	-
418		Carson Wentz (MIN)	QB64	33	185	185	185	0	-
419		Garrett Nussmeier (FA)	QB65	24	185	185	185	0	-
420		Jaydn Ott (FA)	RB122	-	295	319	306.3	9.8	-
421		Kevin Austin Jr. (NO)	WR164	25	220	339	279.5	59.5	-
422		Romello Brinson (FA)	WR165	-	197	197	197	0	-
423		Daniel Bellinger (NYG)	TE71	25	273	387	335.4	37.3	-
424		Harrison Wallace III (FA)	WR166	-	199	199	199	0	-
425		Zack Moss (FA)	RB123	28	253	311	282	29	-
426		Alexander Mattison (MIA)	RB124	27	263	303	283	20	-
427		Aaron Anderson (FA)	WR167	-	266	306	286	20	-
428		Reggie Virgil (FA)	WR168	-	209	209	209	0	-
429		Tyler Conklin (LAC)	TE72	30	282	395	333	43.4	-
430		Jahdae Walker (CHI)	WR169	23	234	340	287	53	-
431		Ty Chandler (MIN)	RB125	27	266	309	287.5	21.5	-
432		Curtis Samuel (BUF)	WR170	29	259	353	326.3	38.9	-
433		Jordan Watkins (SF)	WR171	24	289	342	314	21.7	-
434		Brock Wright (DET)	TE73	27	276	388	332.8	39.8	-
435		Jalin Hyatt (NYG)	WR172	24	294	383	338	33	-
436		Sterling Shepard (TB)	WR173	33	274	348	314.7	30.6	-
437		Jeremy Ruckert (NYJ)	TE74	25	278	391	333.8	45.2	-
438		Carson Beck (FA)	QB66	-	217	217	217	0	-
439		George Holani (SEA)	RB126	26	307	343	328.3	13.7	-
440		Jaret Patterson (LAC)	RB127	26	231	231	231	0	-
441		Tyler Badie (DEN)	RB128	26	283	314	298.5	15.5	-
442		Sam Roush (FA)	TE75	-	294	303	298.5	4.5	-
443		Caleb Douglas (FA)	WR174	-	234	234	234	0	-
444		Isaiah Williams (NYJ)	WR175	25	267	332	299.5	32.5	-
445		Drew Allar (FA)	QB67	21	243	243	243	0	-
446		Eli Raridon (FA)	TE76	-	292	318	305	13	-
447		Josh Reynolds (NYJ)	WR176	31	272	339	305.5	33.5	-
448		Dallen Bentley (FA)	TE77	-	293	322	307.5	14.5	-
449		Barion Brown (FA)	WR177	-	253	253	253	0	-
450		Zavier Scott (MIN)	RB129	26	254	254	254	0	-
451		Kaelon Black (FA)	RB130	-	296	323	309.5	13.5	-
452		Josh Cameron (FA)	WR178	-	256	256	256	0	-
453		Marlin Klein (FA)	TE78	-	307	313	310	3	-
454		Cole Payton (FA)	QB68	-	258	258	258	0	-
455		Isaiah Hodgins (NYG)	WR179	27	313	313	313	0	-
456		Arian Smith (NYJ)	WR180	24	300	327	313.5	13.5	-
457		Brevin Jordan (HOU)	TE79	25	264	264	264	0	-
458		Xavier Weaver (ARI)	WR181	25	264	264	264	0	-
459		Eric Rivers (FA)	WR182	-	267	267	267	0	-
460		Sincere McCormick (FA)	RB131	25	269	269	269	0	-
461		Oscar Delp (FA)	TE80	-	311	325	318	7	-
462		John Bates (WAS)	TE81	28	272	396	334	62	-
463		Mitch Tinsley (CIN)	WR183	26	287	377	337.7	37.6	-
464		Vinny Anthony II (FA)	WR184	-	280	280	280	0	-
465		David Sills V (ATL)	WR185	29	282	376	329	47	-
466		Tyler Goodson (IND)	RB132	25	284	284	284	0	-
467		Deshaun Watson (CLE)	QB69	30	286	286	286	0	-
468		Mitchell Trubisky (BUF)	QB70	31	291	291	291	0	-
469		Joshua Dobbs (NE)	QB71	31	292	292	292	0	-
470		Tip Reiman (ARI)	TE82	24	293	293	293	0	-
471		Kalif Raymond (DET)	WR186	31	294	294	294	0	-
472		Cam Akers (SEA)	RB133	26	309	349	329	20	-
473		Tyler Johnson (NYJ)	WR187	27	296	296	296	0	-
474		Nathan Carter (ATL)	RB134	23	297	297	297	0	-
475		Dae'Quan Wright (FA)	TE83	-	306	306	306	0	-
476		Kalel Mullings (TEN)	RB135	23	307	307	307	0	-
477		Jacob Cowing (SF)	WR188	25	330	341	335.5	5.5	-
478		John Michael Gyllenborg (FA)	TE84	-	308	308	308	0	-
479		Dare Ogunbowale (HOU)	RB136	31	311	311	311	0	-
480		Marquez Valdes-Scantling (PIT)	WR189	31	312	312	312	0	-
481		Josh Cuevas (FA)	TE85	-	312	312	312	0	-
482		Jackson Hawes (BUF)	TE86	25	330	385	353.7	23.1	-
483		Van Jefferson (TEN)	WR190	29	314	314	314	0	-
484		Terrell Jennings (NE)	RB137	24	315	315	315	0	-
485		Desmond Reid (FA)	RB138	-	315	315	315	0	-
486		Hunter Long (JAC)	TE87	27	321	392	357.3	29	-
487		Hassan Haskins (LAC)	RB139	26	318	318	318	0	-
488		Tyler Scott (LAR)	WR191	24	323	323	323	0	-
489		Tyson Bagent (CHI)	QB72	25	325	325	325	0	-
490		Tim Patrick (JAC)	WR192	32	327	327	327	0	-
491		Isaiah Williams (FA)	WR193	39	331	331	331	0	-
492		Grant Calcaterra (PHI)	TE88	27	331	331	331	0	-
493		Jared Wayne (HOU)	WR194	25	331	331	331	0	-
494		Evan Hull (NO)	RB140	25	332	332	332	0	-
495		A.J. Dillon (PHI)	RB141	27	333	333	333	0	-
496		C.J. Daniels (FA)	WR195	-	333	333	333	0	-
497		Dane Key (FA)	WR196	-	334	334	334	0	-
498		Luke Schoonmaker (DAL)	TE89	27	336	336	336	0	-
499		Henry Ruggs III (FA)	WR197	27	337	337	337	0	-
500		Tanner Hudson (CIN)	TE90	31	338	338	338	0	-
501		Nick Nash (WAS)	WR198	25	347	347	347	0	-
502		Lil'Jordan Humphrey (DEN)	WR199	27	350	350	350	0	-
503		Allen Lazard (FA)	WR200	30	356	356	356	0	-
504		Ricky White III (SEA)	WR201	24	356	356	356	0	-
505		Kameron Johnson (TB)	WR202	23	358	358	358	0	-
506		Jamari Thrash (CLE)	WR203	25	361	361	361	0	-
507		Chris Moore (WAS)	WR204	32	363	363	363	0	-
508		Adam Trautman (DEN)	TE91	29	365	365	365	0	-
509		Zay Jones (ARI)	WR205	30	369	369	369	0	-
510		Cedrick Wilson Jr. (MIA)	WR206	30	370	370	370	0	-
511		David Moore (CAR)	WR207	31	371	371	371	0	-
512		Dante Pettis (NO)	WR208	30	372	372	372	0	-
513		Michael Bandy (FA)	WR209	28	373	373	373	0	-
514		Shedrick Jackson (LV)	WR210	26	374	374	374	0	-
515		Xavier Smith (LAR)	WR211	28	375	375	375	0	-
516		Casey Washington (ATL)	WR212	24	378	378	378	0	-
517		Scotty Miller (PIT)	WR213	28	379	379	379	0	-
518		Jonathan Mingo (DAL)	WR214	24	380	380	380	0	-
519		Trent Sherfield Sr. (FA)	WR215	30	381	381	381	0	-
520		Ben Skowronek (PIT)	WR216	28	382	382	382	0	-
521		Foster Moreau (NO)	TE92	28	384	384	384	0	-
522		Julian Hill (MIA)	TE93	25	397	397	397	0	-"""

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
    """Parse tab-separated. Col 2=name, 3=POS, 7=AVG."""
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

    return f"""-- PPR / dynasty / superflex baseline rankings
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
-- Deduplicate by match_name (same player can appear twice, e.g. Isaiah Williams NYJ vs FA)
lookup_dedup AS (
  SELECT DISTINCT ON (match_name) input_name, position, avg_rank, is_fa, match_name
  FROM lookup
  ORDER BY match_name, avg_rank ASC
),

ins_baseline AS (
  INSERT INTO public.baseline_community_rankings (scoring_format, league_type, is_superflex, player_id, rank)
  SELECT
    'ppr'::text,
    'dynasty'::text,
    true,
    pl.id,
    l.avg_rank
  FROM lookup_dedup l
  INNER JOIN public.players pl ON pl.name = l.match_name AND pl.season = 2025
  ON CONFLICT (scoring_format, league_type, is_superflex, player_id)
  DO UPDATE SET rank = EXCLUDED.rank
)

INSERT INTO public.baseline_rookies (name, position, rank, scoring_format, league_type, is_superflex)
SELECT l.input_name, l.position, l.avg_rank, 'ppr'::text, 'dynasty'::text, true
FROM lookup_dedup l
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
      AND br.is_superflex = true
  )
ON CONFLICT (scoring_format, league_type, is_superflex, name) DO NOTHING;
"""


def main():
    rows = parse()
    fa_count = sum(1 for r in rows if r[4])
    if len(sys.argv) > 1 and sys.argv[1] == "--migration":
        out = generate_migration()
        out_path = "supabase/migrations/20260219230000_ppr_dynasty_superflex_baseline.sql"
        with open(out_path, "w") as f:
            f.write(out)
        print(f"Wrote migration to {out_path}")
        print(f"Parsed {len(rows)} rows, {fa_count} FA players")
    else:
        print("-- PPR/dynasty/superflex baseline: parsed", len(rows), "rows, FA:", fa_count)
        print("Run with --migration to generate migration file")


if __name__ == "__main__":
    main()
