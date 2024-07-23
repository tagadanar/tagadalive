class EffectOverTime{
	Item item
	integer value
	//stats
	integer duration
	
	// TODO add stats
	constructor(Item item, integer value, integer duration){
		this.item = item
		this.value = value
		this.duration = duration
	}
	
	constructor(EntityEffect effect){
		this.item = effect.item
		this.value = effect.value * TargetType.CONVERTER[effect.type] // so malus is negative
		//this.stats = Stats.entityEffectType_to_stats[effect.type]
		this.duration = effect.turns
	}
	
	string string(){
		return '<EffectOverTime '+this.item+'\n|value: '+this.value+' |duration: '+this.duration+'>'
	}
}