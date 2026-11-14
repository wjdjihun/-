import argparse
import json
from pathlib import Path
import joblib
import numpy as np
from xgboost import XGBRegressor
from ml.preprocessing import load_prices
from ml.feature_engineering import engineer_features,time_split,PRICE_FEATURES,ECON_FEATURES,NEWS_FEATURES
from ml.evaluate import evaluate

def train(path: Path, output: Path, allow_demo=False):
    source=load_prices(path,allow_demo=allow_demo)
    frame=engineer_features(source)
    training,validation,test=time_split(frame)
    identity=sorted(c for c in frame if c.startswith('product_') and c!='product_id')
    a=PRICE_FEATURES+ECON_FEATURES+identity
    b=a+NEWS_FEATURES
    result={'status':'trained' if source['data_mode'].iloc[0]=='live' else 'demo_trained','data_mode':source['data_mode'].iloc[0], 'rows':len(training), 'period':f"{training.date.min().date()} ~ {training.date.max().date()}", 'models':{'baseline':evaluate(test['target'],test['price'])}, 'splits':{label:{'start':str(df.date.min().date()),'end':str(df.date.max().date()),'rows':len(df),'label_end':str(df.label_end.max().date())} for label,df in [('train',training),('validation',validation),('test',test)]},'target':'mean retail price on days +27 through +33', 'horizon_days':30,'news_window_days':7,'feature_importance':{},'training_cutoff':str(source.date.max().date())}
    output.mkdir(parents=True,exist_ok=True)
    for name,features in [('model_a',a),('model_b',b)]:
        model=XGBRegressor(n_estimators=350,max_depth=4,learning_rate=.045,subsample=.9,colsample_bytree=.9,objective='reg:squarederror',random_state=42,n_jobs=2,early_stopping_rounds=25)
        model.fit(training[features],training['target'],eval_set=[(validation[features],validation['target'])],verbose=False)
        result['models'][name]=evaluate(test['target'],model.predict(test[features]))
        # Fit interval radii on validation only; test labels never tune the model or interval.
        residual=np.abs(validation['target'].to_numpy()-model.predict(validation[features]))
        radius=float(np.quantile(residual,.9,method='higher'))
        per_product={}
        for id in sorted(validation.product_id.unique()):
            mask=validation.product_id==id
            per_product[id]=float(np.quantile(residual[mask],.9,method='higher'))
        joblib.dump({'model':model,'features':features,'radius':radius,'product_radius':per_product,'data_mode':result['data_mode'],'training_cutoff':result['training_cutoff'],'reference_metadata':{id:{k:str(g[k].iloc[0]) for k in ('spec','grade','region')} for id,g in source.groupby('product_id')}},output/f'{name}.joblib')
        if name=='model_b':
            result['feature_importance']=dict(sorted(zip(features,map(float,model.feature_importances_)),key=lambda x:x[1],reverse=True))
            radii=np.array([per_product.get(id,radius) for id in test.product_id])
            result['interval_test_coverage']=float(np.mean(np.abs(test['target'].to_numpy()-model.predict(test[features]))<=radii))
            first_product=sorted(test.product_id.unique())[0]
            subset=test[test.product_id==first_product]
            estimates=model.predict(subset[features])
            result['backtest']=[{'date':str(row.target_date.date()),'actual':float(row.target),'predicted':float(estimate),'product_id':first_product} for (_,row),estimate in zip(subset.iterrows(),estimates)]
    result['news_improvement_mape']=result['models']['model_a']['MAPE']-result['models']['model_b']['MAPE']
    (output/'metrics.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='시계열 경계 구간을 둔 30일 후 가격 모델 학습')
    parser.add_argument('--data',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=Path('ml/artifacts'))
    parser.add_argument('--allow-demo',action='store_true')
    args=parser.parse_args()
    result=train(args.data,args.output,args.allow_demo)
    print(json.dumps({'status':result['status'],'data_mode':result['data_mode'],'models':result['models']},ensure_ascii=False,indent=2))
