def transform_df(df):
    new_df = pd.DataFrame(columns=['age', 'blue', 'brown', 'green', 'month', 'day', 'height'])
    new_df['age'] = df['age']

    new_df['month'] = pd.to_datetime(df['dates']).dt.month
    new_df['day'] = pd.to_datetime(df['dates']).dt.day
    new_df['height'] =