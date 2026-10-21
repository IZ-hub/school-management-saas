/** Nigeria's 36 states and the FCT. */
export const nigeriaStates = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

/**
 * Suggested cities, towns and well-known areas for each state, state capital first.
 * Not exhaustive: the City / town field still accepts any place typed in.
 */
export const nigeriaCities: Record<string, string[]> = {
  Abia: ['Umuahia', 'Aba', 'Ohafia', 'Arochukwu', 'Abiriba', 'Bende', 'Isuikwuato', 'Uzuakoli', 'Item', 'Umunneochi', 'Isiala Ngwa', 'Ukwa'],
  Adamawa: ['Yola', 'Jimeta', 'Mubi', 'Numan', 'Ganye', 'Michika', 'Gombi', 'Hong', 'Song', 'Mayo-Belwa', 'Guyuk'],
  'Akwa Ibom': ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron', 'Abak', 'Ikot Abasi', 'Itu', 'Etinan', 'Ibeno', 'Ikono', 'Ini', 'Mkpat Enin'],
  Anambra: [
    'Awka', 'Onitsha', 'Nnewi', 'Ekwulobia', 'Nkpor', 'Obosi', 'Ihiala', 'Ogidi', 'Agulu', 'Amawbia', 'Abagana', 'Abatete', 'Abba',
    'Achalla', 'Achina', 'Adazi-Nnukwu', 'Aguata', 'Aguleri', 'Ajalli', 'Alor', 'Amichi', 'Anaku', 'Atani', 'Awka-Etiti', 'Awkuzu',
    'Enugwu-Ukwu', 'Eziowelle', 'Fegge', 'GRA Onitsha', 'Ichi', 'Ichida', 'Ifitedunu', 'Igbo-Ukwu', 'Inland Town', 'Isuofia', 'Mbosi',
    'Mgbakwu', 'Nanka', 'Neni', 'Nibo', 'Nimo', 'Nise', 'Nkwelle-Ezunaka', 'Nnobi', 'Nteje', 'Nzam', 'Oba', 'Odekpe', 'Odoakpu', 'Ojoto',
    'Okija', 'Oko', 'Okpoko', 'Okpuno', 'Omor', 'Oraifite', 'Ossomala', 'Osumenyi', 'Otolo', 'Otuocha', 'Ozubulu', 'Uga', 'Ukpo', 'Ukpor',
    'Uli', 'Umuchu', 'Umudim', 'Umudioka', 'Umueje', 'Umueri', 'Umuleri', 'Umunya', 'Umunze', 'Unubi', 'Uruagu', 'Woliwo'
  ],
  Bauchi: ['Bauchi', 'Azare', 'Misau', "Jama'are", 'Katagum', 'Ningi', 'Dass', 'Tafawa Balewa', 'Alkaleri', 'Darazo', 'Kirfi', 'Toro'],
  Bayelsa: ['Yenagoa', 'Brass', 'Ogbia', 'Sagbama', 'Nembe', 'Kaiama', 'Amassoma', 'Oporoma', 'Odi'],
  Benue: ['Makurdi', 'Gboko', 'Otukpo', 'Katsina-Ala', 'Vandeikya', 'Adikpo', 'Zaki Biam', 'Aliade', 'Ugbokpo', 'Oju', 'Wannune'],
  Borno: ['Maiduguri', 'Biu', 'Bama', 'Dikwa', 'Gwoza', 'Monguno', 'Konduga', 'Damboa', 'Ngala', 'Askira', 'Kukawa'],
  'Cross River': ['Calabar', 'Ikom', 'Ogoja', 'Obudu', 'Ugep', 'Akamkpa', 'Obubra', 'Odukpani', 'Akpabuyo', 'Boki'],
  Delta: [
    'Asaba', 'Warri', 'Effurun', 'Sapele', 'Ughelli', 'Agbor', 'Abraka', 'Ogwashi-Uku', 'Ozoro', 'Oleh', 'Kwale', 'Oghara', 'Agbarho',
    'Aladja', 'Amukpe', 'Bomadi', 'Burutu', 'Cable Point', 'Edjeba', 'Ekpan', 'Eku', 'Ekurede', 'Emevor', 'Enerhen', 'Evwreni', 'Ibusa',
    'Illah', 'Isiokolo', 'Issele-Uku', 'Jakpa', 'Jesse', 'Koko', 'Mosogar', 'Obiaruku', 'Ogbe-Ijoh', 'Okere', 'Okpanam', 'Okumagba',
    'Okwe', 'Onicha-Ugbo', 'Orerokpe', 'Orhuwhorun', 'Otor-Udu', 'Otovwodo', 'Otu-Jeremi', 'Ovwian', 'Owa-Oyibu', 'Patani', 'Ugbuwangue',
    'Umunede', 'Umutu', 'Utagba-Uno'
  ],
  Ebonyi: ['Abakaliki', 'Afikpo', 'Onueke', 'Ezza', 'Ishielu', 'Ikwo', 'Ohaozara', 'Edda', 'Amasiri', 'Uburu'],
  Edo: [
    'Benin City', 'Auchi', 'Ekpoma', 'Uromi', 'Irrua', 'Okada', 'Igarra', 'Ubiaja', 'Abudu', 'Adolor', 'Aduwawa', 'Afuze', 'Agenebode',
    'Airport Road', 'Aviele', 'Ehor', 'Ekenwan', 'Ekiadolor', 'Ekpon', 'Evbuotubu', 'Ewatto', 'Ewohimi', 'Fugar', 'GRA Benin', 'Ibillo',
    'Igueben', 'Iguobazuwa', 'Ihievbe', 'Ikpoba Hill', 'Iruekpen', 'Isiohor', 'Iyamho', 'Jattu', 'New Benin', 'Ogida', 'Okhoro', 'Oko',
    'Ososo', 'Otuo', 'Ring Road', 'Sabongida-Ora', 'Sapele Road', 'Siluko', 'Somorika', 'South Ibie', 'Ugbegun', 'Ugbekun', 'Ugbor',
    'Ugbowo', 'Upper Sakponba', 'Urhonigbe', 'Uselu', 'Usen', 'Uwasota', 'Uzea', 'Uzebba', 'Weppa'
  ],
  Ekiti: ['Ado-Ekiti', 'Ikere-Ekiti', 'Ijero-Ekiti', 'Ise-Ekiti', 'Efon-Alaaye', 'Ikole-Ekiti', 'Ido-Ekiti', 'Oye-Ekiti', 'Omuo-Ekiti', 'Aramoko-Ekiti', 'Emure-Ekiti', 'Igede-Ekiti'],
  Enugu: ['Enugu', 'Nsukka', 'Agbani', 'Awgu', 'Oji River', 'Udi', 'Ngwo', 'Emene', 'Abakpa Nike', 'Obollo-Afor', 'Enugu-Ezike', 'Ezeagu'],
  FCT: [
    'Abuja', 'Garki', 'Wuse', 'Maitama', 'Asokoro', 'Central Business District', 'Gwarinpa', 'Jabi', 'Utako', 'Kubwa', 'Lugbe', 'Apo',
    'Lokogoma', 'Life Camp', 'Karu', 'Nyanya', 'Gwagwalada', 'Kuje', 'Bwari', 'Abaji', 'Airport Road', 'Byazhin', 'Dakwo', 'Dawaki',
    'Dei-Dei', 'Durumi', 'Dutse', 'Gaduwa', 'Galadimawa', 'Garki II', 'Gudu', 'Guzape', 'Idu', 'Jahi', 'Jikwoyi', 'Kabusa', 'Kado',
    'Karmo', 'Karshi', 'Katampe', 'Kurudu', 'Kwali', 'Kyami', 'Mabushi', 'Orozo', 'Pyakasa', 'Sauka', 'Ushafa', 'Wumba', 'Wuse II', 'Wuye',
    'Zuba'
  ],
  Gombe: ['Gombe', 'Kaltungo', 'Billiri', 'Dukku', 'Bajoga', 'Deba', 'Kumo', 'Nafada', 'Tula', 'Funakaye'],
  Imo: ['Owerri', 'Orlu', 'Okigwe', 'Mbaise', 'Oguta', 'Mbano', 'Nkwerre', 'Mbaitoli', 'Ihiagwa', 'Umuguma', 'Awo-Omamma', 'Ideato'],
  Jigawa: ['Dutse', 'Hadejia', 'Kazaure', 'Gumel', 'Ringim', 'Birnin Kudu', 'Kafin Hausa', 'Babura', 'Garki', 'Maigatari'],
  Kaduna: ['Kaduna', 'Zaria', 'Kafanchan', 'Kagoro', 'Zonkwa', 'Saminaka', 'Makarfi', 'Kachia', 'Ikara', 'Kagarko', 'Birnin Gwari', 'Sabon Gari'],
  Kano: ['Kano', 'Fagge', 'Nassarawa', 'Tarauni', 'Wudil', 'Gaya', 'Rano', 'Bichi', 'Dambatta', 'Karaye', 'Gwarzo', 'Kura', 'Tudun Wada', 'Sumaila'],
  Katsina: ['Katsina', 'Funtua', 'Daura', 'Malumfashi', 'Kankia', 'Dutsin-Ma', 'Kafur', 'Mani', 'Jibia', 'Bakori'],
  Kebbi: ['Birnin Kebbi', 'Argungu', 'Yauri', 'Zuru', 'Jega', 'Koko', 'Bunza', 'Kamba', 'Bagudo'],
  Kogi: ['Lokoja', 'Okene', 'Kabba', 'Idah', 'Anyigba', 'Ankpa', 'Ajaokuta', 'Obajana', 'Dekina', 'Isanlu', 'Egbe', 'Koton Karfe'],
  Kwara: ['Ilorin', 'Offa', 'Omu-Aran', 'Jebba', 'Lafiagi', 'Patigi', 'Kaiama', 'Share', 'Oro', 'Esie', 'Erin-Ile', 'Ajasse-Ipo'],
  // Our home state: the popular areas first, then every listed area A to Z (grouped from all 20 local government areas).
  Lagos: [
    'Ikeja', 'Lekki', 'Ajah', 'Victoria Island', 'Ikoyi', 'Lagos Island', 'Surulere', 'Yaba', 'Ikorodu', 'Gbagada', 'Magodo',
    'Festac Town', 'Ikotun', 'Ipaja', 'Egbeda', 'Isolo', 'Ogba', 'Ojodu', 'Sangotedo', 'Epe', 'Badagry', 'Ibeju-Lekki', 'Abijo',
    'Abraham Adesanya', 'Abule Ado', 'Abule Egba', 'Addo', 'Adeniji Adele', 'Agbado', 'Agboju', 'Agbowa', 'Agboyi', 'Agege', 'Agidingbi',
    'Ago Palace', 'Agric', 'Aguda', 'Agungi', 'Ajao Estate', 'Ajegunle', 'Ajido', 'Akodo', 'Akoka', 'Akowonjo', 'Alaba', 'Alagomeji',
    'Alapere', 'Alausa', 'Alimosho', 'Allen Avenue', 'Amuwo-Odofin', 'Anthony Village', 'Apapa', 'Awoyaya', 'Ayobo', 'Badore',
    'Banana Island', 'Bariga', 'Baruwa', 'Bayeku', 'Berger', 'Bogije', 'Broad Street', 'Bucknor', 'Chevron', 'Command', 'Dolphin Estate',
    'Dopemu', 'Ebute Metta', 'Ebute-Ikorodu', 'Egan', 'Ejigbo', 'Ejinrin', 'Eko Atlantic', 'Eleko', 'Eputu', 'Fadeyi', 'Gowon Estate',
    'Iba', 'Ibereko', 'Iddo', 'Idi-Araba', 'Idimu', 'Idumota', 'Ifako-Ijaiye', 'Igando', 'Igbo Efon', 'Igbo Elerin', 'Igbogbo', 'Ijanikin',
    'Ijede', 'Ijegun', 'Ijesha', 'Ijora', 'Iju-Ishaga', 'Ikeja GRA', 'Ikola', 'Ikosi', 'Ikota', 'Ilasamaja', 'Ilasan', 'Iloro', 'Ilupeju',
    'Imota', 'Iponri', 'Isale Eko', 'Isawo', 'Isheri', 'Isheri Olofin', 'Itire', 'Itoikin', 'Iwaya', 'Iyana Iba', 'Iyana Ipaja', 'Jibowu',
    'Ketu', 'Kirikiri', 'Kosofe', 'Lakowe', 'Langbasa', 'Lawanson', 'Layeni', 'Lekki Phase 1', 'Mafoluku', 'Majidun', 'Makoko', 'Marina',
    'Maryland', 'Masha', 'Mile 12', 'Mile 2', 'Mushin', 'Noforija', 'Obalende', 'Odi-Olowo', 'Odogunyan', 'Ogba-Ijaiye', 'Ogolonto',
    'Ogombo', 'Ogudu', 'Ogunlana', 'Ojo', 'Ojokoro', 'Ojota', 'Ojuelegba', 'Ojuwoye', 'Oko-Oba', 'Okokomaiko', 'Okota', 'Olodi-Apapa',
    'Omole Phase 1', 'Omole Phase 2', 'Onikan', 'Onipanu', 'Oniru', 'Opebi', 'Oregun', 'Orile Agege', 'Osapa London', 'Oshodi', 'Otto',
    'Owode Onirin', 'Oworonshoki', 'Owutu', 'Oyingbo', 'Palmgrove', 'Papa Ajao', 'Pedro', 'Pen Cinema', 'Sabo', 'Satellite Town', 'Seme',
    'Shasha', 'Shogunle', 'Shomolu', 'Topo'
  ],
  Nasarawa: ['Lafia', 'Keffi', 'Akwanga', 'Karu', 'Mararaba', 'Nasarawa', 'Doma', 'Wamba', 'Obi', 'Nasarawa Eggon', 'Awe', 'Toto'],
  Niger: ['Minna', 'Bida', 'Suleja', 'Kontagora', 'New Bussa', 'Mokwa', 'Lapai', 'Agaie', 'Kagara', 'Rijau', 'Zungeru'],
  Ogun: [
    'Abeokuta', 'Ijebu-Ode', 'Sagamu', 'Ota', 'Sango-Ota', 'Mowe', 'Ibafo', 'Ifo', 'Akute', 'Agbara', 'Ilaro', 'Magboro', 'Abigi',
    'Adigbe', 'Ado-Odo', 'Ago-Iwoye', 'Alabata', 'Arepo', 'Asero', 'Asese', 'Atan', 'Ayetoro', 'Camp', 'Ibara', 'Ibogun', 'Idiroko',
    'Igbesa', 'Ijebu-Igbo', 'Ijebu-Mushin', 'Ikenne', 'Ilishan-Remo', 'Imeko', 'Iperu', 'Ipokia', 'Isara', 'Itori', 'Joga-Orile', 'Kuto',
    'Lafenwa', 'Makun', 'Obafemi', 'Obantoko', 'Ode-Remo', 'Odeda', 'Odogbolu', 'Ofada', 'Ogbere', 'Ogijo', 'Ojodu-Abiodun', 'Oke-Mosan',
    'Okun-Owa', 'Oru', 'Osiele', 'Owode-Egba', 'Owode-Yewa', 'Panseke', 'Papalanto', 'Redemption Camp', 'Wasimi'
  ],
  Ondo: ['Akure', 'Ondo', 'Owo', 'Ikare-Akoko', 'Okitipupa', 'Ore', 'Idanre', 'Igbokoda', 'Oka-Akoko', 'Ifon', 'Ile-Oluji'],
  Osun: ['Osogbo', 'Ile-Ife', 'Ilesa', 'Ede', 'Iwo', 'Ikirun', 'Ila-Orangun', 'Ikire', 'Ilobu', 'Ejigbo', 'Modakeke', 'Ipetu-Ijesa', 'Esa-Oke'],
  Oyo: ['Ibadan', 'Ogbomosho', 'Oyo', 'Iseyin', 'Saki', 'Igboho', 'Eruwa', 'Okeho', 'Kishi', 'Igbo-Ora', 'Lanlate', 'Ido', 'Moniya'],
  Plateau: ['Jos', 'Bukuru', 'Pankshin', 'Shendam', 'Langtang', 'Barkin Ladi', 'Mangu', 'Bokkos', 'Wase', 'Vom'],
  Rivers: [
    'Port Harcourt', 'GRA Phase 1', 'GRA Phase 2', 'Old GRA', 'D-Line', 'Trans-Amadi', 'Rumuokoro', 'Rumuola', 'Choba', 'Woji',
    'Obio-Akpor', 'Eleme', 'Oyigbo', 'Abonnema', 'Abuloma', 'Ada George', 'Afam', 'Ahoada', 'Akpajo', 'Alakahia', 'Alesa', 'Aluu',
    'Amadi-Ama', 'Atali', 'Bonny', 'Bori', 'Borokiri', 'Buguma', 'Degema', 'Diobu', 'Elekahia', 'Elele', 'Elelenwo', 'Eliozu', 'Emohua',
    'Eneka', 'Igwuruta', 'Isiokpo', 'Iwofe', 'Mgbuoba', 'Mile 1', 'Mile 2', 'Mile 3', 'Ndele', 'Oginigba', 'Ogu', 'Okrika', 'Okuru',
    'Omagwa', 'Omoku', 'Onne', 'Ozuoba', 'Peter Odili Road', 'Rukpokwu', 'Rumueme', 'Rumuepirikom', 'Rumuibekwe', 'Rumuigbo', 'Rumuodara',
    'Rumuodomaya', 'Rumuogba', 'Rumuokwuta', 'Rumuolumeni', 'Rumuomasi'
  ],
  Sokoto: ['Sokoto', 'Wurno', 'Tambuwal', 'Gwadabawa', 'Illela', 'Bodinga', 'Dange', 'Goronyo', 'Isa', 'Tangaza', 'Kebbe'],
  Taraba: ['Jalingo', 'Wukari', 'Bali', 'Gembu', 'Takum', 'Serti', 'Zing', 'Ibi', 'Donga', 'Lau', 'Mutum Biyu'],
  Yobe: ['Damaturu', 'Potiskum', 'Gashua', 'Nguru', 'Geidam', 'Buni Yadi', 'Fika', 'Machina', 'Yusufari', 'Dapchi'],
  Zamfara: ['Gusau', 'Kaura Namoda', 'Talata Mafara', 'Anka', 'Tsafe', 'Bungudu', 'Maru', 'Zurmi', 'Shinkafi', 'Bakura'],
}
