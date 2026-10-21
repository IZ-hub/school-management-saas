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
  Anambra: ['Awka', 'Onitsha', 'Nnewi', 'Ekwulobia', 'Ihiala', 'Nkpor', 'Obosi', 'Ogidi', 'Agulu', 'Aguata', 'Otuocha', 'Umunze', 'Oko', 'Atani'],
  Bauchi: ['Bauchi', 'Azare', 'Misau', "Jama'are", 'Katagum', 'Ningi', 'Dass', 'Tafawa Balewa', 'Alkaleri', 'Darazo', 'Kirfi', 'Toro'],
  Bayelsa: ['Yenagoa', 'Brass', 'Ogbia', 'Sagbama', 'Nembe', 'Kaiama', 'Amassoma', 'Oporoma', 'Odi'],
  Benue: ['Makurdi', 'Gboko', 'Otukpo', 'Katsina-Ala', 'Vandeikya', 'Adikpo', 'Zaki Biam', 'Aliade', 'Ugbokpo', 'Oju', 'Wannune'],
  Borno: ['Maiduguri', 'Biu', 'Bama', 'Dikwa', 'Gwoza', 'Monguno', 'Konduga', 'Damboa', 'Ngala', 'Askira', 'Kukawa'],
  'Cross River': ['Calabar', 'Ikom', 'Ogoja', 'Obudu', 'Ugep', 'Akamkpa', 'Obubra', 'Odukpani', 'Akpabuyo', 'Boki'],
  Delta: ['Asaba', 'Warri', 'Effurun', 'Sapele', 'Ughelli', 'Agbor', 'Abraka', 'Oghara', 'Ozoro', 'Kwale', 'Ogwashi-Uku', 'Oleh', 'Burutu', 'Koko', 'Isiokolo'],
  Ebonyi: ['Abakaliki', 'Afikpo', 'Onueke', 'Ezza', 'Ishielu', 'Ikwo', 'Ohaozara', 'Edda', 'Amasiri', 'Uburu'],
  Edo: ['Benin City', 'Auchi', 'Ekpoma', 'Uromi', 'Irrua', 'Igarra', 'Ubiaja', 'Igueben', 'Okada', 'Agenebode', 'Fugar', 'Sabongida-Ora', 'Afuze'],
  Ekiti: ['Ado-Ekiti', 'Ikere-Ekiti', 'Ijero-Ekiti', 'Ise-Ekiti', 'Efon-Alaaye', 'Ikole-Ekiti', 'Ido-Ekiti', 'Oye-Ekiti', 'Omuo-Ekiti', 'Aramoko-Ekiti', 'Emure-Ekiti', 'Igede-Ekiti'],
  Enugu: ['Enugu', 'Nsukka', 'Agbani', 'Awgu', 'Oji River', 'Udi', 'Ngwo', 'Emene', 'Abakpa Nike', 'Obollo-Afor', 'Enugu-Ezike', 'Ezeagu'],
  FCT: ['Abuja', 'Garki', 'Wuse', 'Maitama', 'Asokoro', 'Gwarinpa', 'Jabi', 'Utako', 'Kubwa', 'Lugbe', 'Apo', 'Lokogoma', 'Life Camp', 'Kado', 'Dutse', 'Karu', 'Nyanya', 'Gwagwalada', 'Kuje', 'Bwari', 'Kwali', 'Abaji'],
  Gombe: ['Gombe', 'Kaltungo', 'Billiri', 'Dukku', 'Bajoga', 'Deba', 'Kumo', 'Nafada', 'Tula', 'Funakaye'],
  Imo: ['Owerri', 'Orlu', 'Okigwe', 'Mbaise', 'Oguta', 'Mbano', 'Nkwerre', 'Mbaitoli', 'Ihiagwa', 'Umuguma', 'Awo-Omamma', 'Ideato'],
  Jigawa: ['Dutse', 'Hadejia', 'Kazaure', 'Gumel', 'Ringim', 'Birnin Kudu', 'Kafin Hausa', 'Babura', 'Garki', 'Maigatari'],
  Kaduna: ['Kaduna', 'Zaria', 'Kafanchan', 'Kagoro', 'Zonkwa', 'Saminaka', 'Makarfi', 'Kachia', 'Ikara', 'Kagarko', 'Birnin Gwari', 'Sabon Gari'],
  Kano: ['Kano', 'Fagge', 'Nassarawa', 'Tarauni', 'Wudil', 'Gaya', 'Rano', 'Bichi', 'Dambatta', 'Karaye', 'Gwarzo', 'Kura', 'Tudun Wada', 'Sumaila'],
  Katsina: ['Katsina', 'Funtua', 'Daura', 'Malumfashi', 'Kankia', 'Dutsin-Ma', 'Kafur', 'Mani', 'Jibia', 'Bakori'],
  Kebbi: ['Birnin Kebbi', 'Argungu', 'Yauri', 'Zuru', 'Jega', 'Koko', 'Bunza', 'Kamba', 'Bagudo'],
  Kogi: ['Lokoja', 'Okene', 'Kabba', 'Idah', 'Anyigba', 'Ankpa', 'Ajaokuta', 'Obajana', 'Dekina', 'Isanlu', 'Egbe', 'Koton Karfe'],
  Kwara: ['Ilorin', 'Offa', 'Omu-Aran', 'Jebba', 'Lafiagi', 'Patigi', 'Kaiama', 'Share', 'Oro', 'Esie', 'Erin-Ile', 'Ajasse-Ipo'],
  Lagos: ['Ikeja', 'Lekki', 'Ajah', 'Victoria Island', 'Ikoyi', 'Lagos Island', 'Surulere', 'Yaba', 'Ikorodu', 'Epe', 'Badagry', 'Ibeju-Lekki', 'Sangotedo', 'Festac Town', 'Ojo', 'Alimosho', 'Ipaja', 'Egbeda', 'Ikotun', 'Agege', 'Ogba', 'Ojodu', 'Magodo', 'Ketu', 'Ogudu', 'Gbagada', 'Maryland', 'Ilupeju', 'Isolo', 'Ejigbo', 'Mushin', 'Oshodi', 'Apapa'],
  Nasarawa: ['Lafia', 'Keffi', 'Akwanga', 'Karu', 'Mararaba', 'Nasarawa', 'Doma', 'Wamba', 'Obi', 'Nasarawa Eggon', 'Awe', 'Toto'],
  Niger: ['Minna', 'Bida', 'Suleja', 'Kontagora', 'New Bussa', 'Mokwa', 'Lapai', 'Agaie', 'Kagara', 'Rijau', 'Zungeru'],
  Ogun: ['Abeokuta', 'Ijebu-Ode', 'Sagamu', 'Ota', 'Sango-Ota', 'Ifo', 'Mowe', 'Ibafo', 'Agbara', 'Ilaro', 'Ijebu-Igbo', 'Ago-Iwoye', 'Ayetoro', 'Owode', 'Ikenne', 'Ilishan-Remo'],
  Ondo: ['Akure', 'Ondo', 'Owo', 'Ikare-Akoko', 'Okitipupa', 'Ore', 'Idanre', 'Igbokoda', 'Oka-Akoko', 'Ifon', 'Ile-Oluji'],
  Osun: ['Osogbo', 'Ile-Ife', 'Ilesa', 'Ede', 'Iwo', 'Ikirun', 'Ila-Orangun', 'Ikire', 'Ilobu', 'Ejigbo', 'Modakeke', 'Ipetu-Ijesa', 'Esa-Oke'],
  Oyo: ['Ibadan', 'Ogbomosho', 'Oyo', 'Iseyin', 'Saki', 'Igboho', 'Eruwa', 'Okeho', 'Kishi', 'Igbo-Ora', 'Lanlate', 'Ido', 'Moniya'],
  Plateau: ['Jos', 'Bukuru', 'Pankshin', 'Shendam', 'Langtang', 'Barkin Ladi', 'Mangu', 'Bokkos', 'Wase', 'Vom'],
  Rivers: ['Port Harcourt', 'Obio-Akpor', 'Rumuokoro', 'Choba', 'Trans-Amadi', 'Oyigbo', 'Eleme', 'Okrika', 'Bonny', 'Ahoada', 'Omoku', 'Bori', 'Degema', 'Isiokpo', 'Elele', 'Buguma'],
  Sokoto: ['Sokoto', 'Wurno', 'Tambuwal', 'Gwadabawa', 'Illela', 'Bodinga', 'Dange', 'Goronyo', 'Isa', 'Tangaza', 'Kebbe'],
  Taraba: ['Jalingo', 'Wukari', 'Bali', 'Gembu', 'Takum', 'Serti', 'Zing', 'Ibi', 'Donga', 'Lau', 'Mutum Biyu'],
  Yobe: ['Damaturu', 'Potiskum', 'Gashua', 'Nguru', 'Geidam', 'Buni Yadi', 'Fika', 'Machina', 'Yusufari', 'Dapchi'],
  Zamfara: ['Gusau', 'Kaura Namoda', 'Talata Mafara', 'Anka', 'Tsafe', 'Bungudu', 'Maru', 'Zurmi', 'Shinkafi', 'Bakura'],
}
