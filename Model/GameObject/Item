/*
 * Objet contenant les informations correspondante a une item
 * On en instancie un pour chacun des équipements du jeu
 */
class Item {
	integer id
	string name
	boolean isWeap
	boolean haveCD
	integer minRange
	integer maxRange
	integer launchType
	boolean needLOS
	integer cost
	integer area
	boolean isAOE
	boolean onCaster = false
	Array<ItemEffect> effects = []
	
	integer targetKey
	boolean targetEmptyCell = false
	
	static integer ALL = 0
	static integer ALLLEEKS = 1
	static integer ALLBULBS = 2
	static integer ALLIES = 3
	static integer ALLIESLEEKS = 4
	static integer ALLIESBULBS = 5
	static integer ENEMIES = 6
	static integer ENEMIESLEEKS = 7
	static integer ENEMIESBULBS = 8
	static integer NONE = 9
			
	constructor(integer id) {
		this.id = id
		this.name = getWeaponName(id)+getChipName(id)
		this.isWeap = isWeapon(id)
		if(this.isWeap){
			this.haveCD = false
			this.minRange = getWeaponMinRange(id)
			this.maxRange = getWeaponMaxRange(id)
			this.launchType = getWeaponLaunchType(id)!
			this.needLOS = weaponNeedLos(id)
			this.cost = getWeaponCost(id)
			this.area = getWeaponArea(id)!
			integer i = 0
			for(Array<real | integer> e in getWeaponEffects(id)!){
				push(this.effects, ItemEffect(e, this, i++))
			}
		} else {
			this.haveCD = getChipCooldown(id)!=0
			this.minRange = getChipMinRange(id)!
			this.maxRange = getChipMaxRange(id)!
			this.launchType = getChipLaunchType(id)!
			this.needLOS = chipNeedLos(id)
			this.cost = getChipCost(id)!
			this.area = getChipArea(id)!
			integer i = 0
			for(Array<real | integer> e in getChipEffects(id)!){
				push(this.effects, ItemEffect(e, this, i++))
			}
		}

		if(this.area == AREA_POINT || this.area == AREA_LASER_LINE) this.isAOE = false
		else this.isAOE = true
		// on cherche à trouver quels sont les cibles valides et intéressante de l'item
		// on set targetKey pour que targetSet pointe vers la fonction qui renvera uniquement les entités intéressante à cibler
		boolean allies = false, enemies = false, onBulbs = false, onLeeks = false;
		/*for(ItemEffect e in this.effects){
			if(!allies) allies = e.targetType.allies
			if(!enemies) enemies = e.targetType.enemies
			if(!onBulbs) onBulbs = e.targetType.onBulbs
			if(!onLeeks) onLeeks = e.targetType.onLeeks
			if(!this.onCaster) this.onCaster = e.targetType.onCaster
		}*/
		
		if(false){ // TODO FAIRE UNE PASSE SUR LES ITEMS POUR CHECK SI TOUT EST COMME JE LE SOUHAITE §
			// + coder les items chelous dans TargetType
			debug(this)
			debug("allies:"+allies)
			debug("enemies:"+enemies)
			debug("onBulbs:"+onBulbs)
			debug("onLeeks:"+onLeeks)
			pause()
		}
		
		// si c'est un lazer, je veux potentiellement tirer à travers tout le monde ^^
		if(this.area == AREA_LASER_LINE){
			allies = true
			enemies = true
			onBulbs = true
			onLeeks = true
		}
		
		if(allies && enemies){ // ALL
			if(onLeeks && onBulbs) this.targetKey = Item.ALL
			else if(onLeeks && !onBulbs) this.targetKey = Item.ALLLEEKS
			else if(!onLeeks && onBulbs) this.targetKey = Item.ALLBULBS
			else{
				debugW('strange targetKey in <Item> for '+this)
				this.targetKey = Item.NONE
			}
		} else if(allies && !enemies){ // only ALLIES
			if(onLeeks && onBulbs) this.targetKey = Item.ALLIES
			else if(onLeeks && !onBulbs) this.targetKey = Item.ALLIESLEEKS
			else if(!onLeeks && onBulbs) this.targetKey = Item.ALLIESBULBS
			else{
				debugW('strange targetKey in <Item> for '+this)
				this.targetKey = Item.NONE
			}

		} else if(!allies && enemies){ // only ENEMIES
			if(onLeeks && onBulbs) this.targetKey = Item.ENEMIES
			else if(onLeeks && !onBulbs) this.targetKey = Item.ENEMIESLEEKS
			else if(!onLeeks && onBulbs) this.targetKey = Item.ENEMIESBULBS
			else{
				debugW('strange targetKey in <Item> for '+this)
				this.targetKey = Item.NONE
			}
		} else { // none: cas des actions avec des items de déplacements teleport, ou des invocs
			this.targetKey = Item.NONE
			targetEmptyCell = true // TODO handle this param in IA
		}
	}
	
	Map<integer, Entity> targetSet(){
		if(this.targetKey==ALL) return Fight.getAllAlive()
		if(this.targetKey==ALLLEEKS) return Fight.getAllLeeksAlive()
		if(this.targetKey==ALLBULBS) return Fight.getAllBulbsAlive()
		if(this.targetKey==ALLIES) return Fight.getAlliesAlive()
		if(this.targetKey==ALLIESLEEKS) return Fight.getAlliesLeeksAlive()
		if(this.targetKey==ALLIESBULBS) return Fight.getAlliesBulbsAlive()
		if(this.targetKey==ENEMIES) return Fight.getEnemiesAlive()
		if(this.targetKey==ENEMIESLEEKS) return Fight.getEnemiesLeeksAlive()
		if(this.targetKey==ENEMIESBULBS) return Fight.getEnemiesBulbsAlive()
		if(this.targetKey==NONE) return [:]
	}
	
	/*
	 * tente d'utiliser l'item
	 * @param cell cellule de type Cell représentant l'endroit ou je veux utiliser l'Item avec id: (this.id)
	 */
	void useItemOnCell(Cell cell){
		if(this.isWeap){
			if(getWeapon(Fight.self.id)!=this.id) setWeapon(this.id)
			useWeaponOnCell(cell.id)
		} else useChipOnCell(this.id, cell.id)
	}
	
	/*
	 * tente d'utiliser l'item
	 * @param cell cellule de type Cell représentant l'endroit ou je veux utiliser l'Item avec id: (this.id)
	 */
	void useItem(Entity entity){
		if(this.isWeap){
			if(getWeapon(Fight.self.id)!=this.id) setWeapon(this.id)
			useWeapon(entity.id)
		} else useChip(this.id, entity.id)
	}
	
	/*
	 * Format chaîne de caracteres utilisée pour des tests / debugs.
	 */
	string() {
		return "<Item "+this.name+">"
	}
}